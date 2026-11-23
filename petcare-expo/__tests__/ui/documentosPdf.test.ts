/* Parte de plataforma de Documentos: el HTML de la hoja y el camino web (sin archivo). */
jest.mock("expo-print", () => ({ printToFileAsync: jest.fn(), printAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { LocalDate } from "../../src/util/tiempo";
import { crearDatosPaciente, crearProfesional, planoDeCertificadoSalud, planoDeReceta } from "../../src/ui/common/Documentos";
import { compartir, generarPdf, htmlDePlano } from "../../src/ui/common/DocumentosPdf";
import { crearPrescripcion } from "../../src/model/clinica";

const vet = crearProfesional({ nombre: "Dra. Vera", matricula: "MP-100", clinica: "Clínica <Sur>", direccion: "Av. Siempreviva 742", telefono: "1155550000" });
const paciente = crearDatosPaciente({ nombre: "Rex", especie: "Perro", raza: "Mestizo", propietario: "Ana Prueba", microchip: "985" });
const fecha = LocalDate.of(2026, 10, 12);

describe("DocumentosPdf", () => {
  it("el HTML tiene el encabezado, el paciente, las indicaciones y la firma con la matrícula", () => {
    const plano = planoDeReceta(vet, paciente, fecha, [crearPrescripcion({ id: "p", mascotaId: "m", medicamento: "Amoxicilina", dosis: "250 mg" })], "Reposo");
    const html = htmlDePlano(plano);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("RECETA VETERINARIA");
    expect(html).toContain("Clínica &lt;Sur&gt;");
    expect(html).toContain("Av. Siempreviva 742 · 1155550000");
    expect(html).toContain("Microchip: 985");
    expect(html).toContain("1. Amoxicilina");
    expect(html).toContain("Recomendaciones");
    expect(html).toContain("Matrícula MP-100");
    expect(html).toContain("Emitido con PetCare");
    expect(html).toContain("size: 595pt 842pt");
  });

  it("en la web no se genera archivo y el HTML queda en el resultado", async () => {
    const original = Platform.OS;
    Platform.OS = "web";
    try {
      const archivo = await generarPdf(planoDeCertificadoSalud(vet, paciente, fecha));
      expect(archivo.uri).toBeNull();
      expect(archivo.nombre).toBe("certificado-salud-rex-2026-10-12.pdf");
      expect(archivo.html).toContain("CERTIFICADO DE SALUD");
      expect(Print.printToFileAsync).not.toHaveBeenCalled();
    } finally {
      Platform.OS = original;
    }
  });

  it("en el celular se arma el PDF con expo-print y se comparte con expo-sharing", async () => {
    (Print.printToFileAsync as jest.Mock).mockResolvedValue({ uri: "file:///cache/Print/xyz.pdf", numberOfPages: 1 });
    const archivo = await generarPdf(planoDeCertificadoSalud(vet, paciente, fecha));
    expect(Print.printToFileAsync).toHaveBeenCalledWith(expect.objectContaining({ width: 595, height: 842 }));
    expect(archivo.uri).toContain(".pdf");
    expect(await compartir({ ...archivo, uri: "file:///cache/documentos/x.pdf" }, "Certificado")).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/documentos/x.pdf", expect.objectContaining({ mimeType: "application/pdf" }));
  });
});
