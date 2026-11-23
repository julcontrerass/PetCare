/* Migrado de DocumentosTest.kt: prueba lo que se imprime en los PDF (el contenido, sin generar el archivo). */
import "../soporte/pruebaBase"; // simula los módulos nativos (almacenamiento y notificaciones) antes de importar los repositorios
import { crearRegistroSalud } from "../../src/data/repositorio/saludRepo";
import { crearPrescripcion } from "../../src/model/clinica";
import { LocalDate } from "../../src/util/tiempo";
import {
  crearDatosPaciente, crearProfesional, Documentos,
} from "../../src/ui/common/Documentos";

const vet = crearProfesional({ nombre: "Dra. Vera", matricula: "MP-100", clinica: "Clínica Sur", direccion: "Av. Siempreviva 742", telefono: "1155550000" });
const paciente = crearDatosPaciente({
  nombre: "Rex", especie: "Perro", raza: "Mestizo", sexo: "Macho", edad: "6 años", peso: "12 kg", propietario: "Ana Prueba",
});
const fecha = LocalDate.of(2026, 10, 12);

describe("Documentos", () => {
  it("la receta lleva matrícula, paciente y medicamentos", () => {
    const medicamentos = [
      crearPrescripcion({ id: "p1", mascotaId: "m1", turnoId: "t1", medicamento: "Amoxicilina", dosis: "250 mg", frecuenciaHoras: 8, duracionDias: 7, indicaciones: "Con comida" }),
      crearPrescripcion({ id: "p2", mascotaId: "m1", turnoId: "t1", medicamento: "Meloxicam" }),
    ];

    const plano = Documentos.planoDeReceta(vet, paciente, fecha, medicamentos, "Reposo 3 días");
    const texto = plano.texto();

    expect(texto).toContain("RECETA VETERINARIA");
    expect(texto).toContain("Matrícula MP-100");
    expect(texto).toContain("Rex");
    expect(texto).toContain("Ana Prueba");
    expect(texto).toContain("1. Amoxicilina");
    expect(texto).toContain("250 mg, cada 8 hs, durante 7 días");
    expect(texto).toContain("2. Meloxicam");
    expect(texto).toContain("Reposo 3 días");
    expect(Documentos.nombreDeArchivo(plano)).toBe("receta-rex-2026-10-12.pdf");
  });

  it("la receta sin medicamentos lo dice", () => {
    expect(Documentos.planoDeReceta(vet, paciente, fecha, []).texto()).toContain("Sin medicamentos indicados.");
  });

  it("el certificado de vacunación lista las vacunas con lote", () => {
    const vacuna = crearRegistroSalud({
      id: "r1", tipo: "VACUNA", mascotaId: "m1", mascota: "Rex", titulo: "Antirrábica", detalle: "", fecha: "05 Oct 2026",
      marca: "Nobivac", lote: "A123", proximaDosis: LocalDate.of(2027, 10, 5),
    });

    const texto = Documentos.planoDeCertificadoVacunacion(vet, paciente, fecha, [vacuna]).texto();

    expect(texto).toContain("CERTIFICADO DE VACUNACIÓN");
    expect(texto).toContain("matrícula MP-100");
    expect(texto).toContain("Antirrábica");
    expect(texto).toContain("Producto: Nobivac");
    expect(texto).toContain("Lote: A123");
  });

  it("el certificado de vacunación sin vacunas lo dice", () => {
    const texto = Documentos.planoDeCertificadoVacunacion(vet, paciente, fecha, []).texto();
    expect(texto).toContain("No hay vacunas registradas.");
  });

  it("el certificado de salud incluye la validez y las observaciones", () => {
    const texto = Documentos.planoDeCertificadoSalud(vet, paciente, fecha, "Sin hallazgos").texto();

    expect(texto).toContain("CERTIFICADO DE SALUD");
    expect(texto).toContain("validez de 10 días");
    expect(texto).toContain("Sin hallazgos");
    expect(texto).not.toContain("No hay vacunas");
  });

  it("el nombre del archivo limpia los caracteres raros y usa 'mascota' si no queda nada", () => {
    const rara = crearDatosPaciente({ nombre: "Ñandú & Co.", especie: "Ave" });
    expect(Documentos.nombreDeArchivo(Documentos.planoDeCertificadoSalud(vet, rara, fecha))).toBe("certificado-salud-and-co-2026-10-12.pdf");
    const vacia = crearDatosPaciente({ nombre: "***", especie: "Ave" });
    expect(Documentos.nombreDeArchivo(Documentos.planoDeCertificadoSalud(vet, vacia, fecha))).toBe("certificado-salud-mascota-2026-10-12.pdf");
  });

  it("el encabezado usa PetCare si no hay clínica", () => {
    const sinClinica = crearProfesional({ nombre: "Dr. Pérez", matricula: "MP-7" });
    expect(Documentos.planoDeCertificadoSalud(sinClinica, paciente, fecha).texto().startsWith("PetCare\nDr. Pérez · Matrícula MP-7")).toBe(true);
  });
});
