/* ArchivosUi: validación de lo que se elige (tipo y tamaño de hasta 15 MB). */
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));

import "../soporte/pruebaBase"; // simula almacenamiento y notificaciones antes de importar los repositorios
import * as DocumentPicker from "expo-document-picker";
import { Imagenes } from "../../src/data/imagenes";
import { Avisos } from "../../src/ui/common/Avisos";
import { ArchivosUi, TAMANO_MAXIMO } from "../../src/ui/common/ArchivosUi";

beforeEach(() => Avisos.reiniciar());
afterEach(() => {
  Avisos.reiniciar();
  jest.restoreAllMocks();
});

describe("ArchivosUi", () => {
  it("mimeDe conoce los tipos admitidos", () => {
    expect(ArchivosUi.mimeDe("PDF")).toBe("application/pdf");
    expect(ArchivosUi.mimeDe("jpg")).toBe("image/jpeg");
    expect(ArchivosUi.mimeDe("docx")).toContain("wordprocessingml");
    expect(ArchivosUi.mimeDe("zip")).toBe("*/*");
  });

  it("lee un archivo admitido", async () => {
    jest.spyOn(Imagenes, "bytesDe").mockResolvedValue(new Uint8Array([1, 2, 3]));
    const archivo = await ArchivosUi.leer("file:///cache/Radiografia.PDF", "Radiografia.PDF");
    expect(archivo).toEqual({ nombre: "Radiografia.PDF", extension: "pdf", mime: "application/pdf", bytes: new Uint8Array([1, 2, 3]) });
  });

  it("saca el nombre de la uri si el selector no lo da", async () => {
    jest.spyOn(Imagenes, "bytesDe").mockResolvedValue(new Uint8Array([1]));
    const archivo = await ArchivosUi.leer("file:///cache/estudio%20sangre.png");
    expect(archivo?.nombre).toBe("estudio sangre.png");
    expect(archivo?.mime).toBe("image/png");
  });

  it("rechaza un formato no admitido", async () => {
    expect(await ArchivosUi.leer("file:///cache/datos.zip", "datos.zip")).toBeNull();
    expect(Avisos.estado.banner?.mensaje).toBe("Formato no admitido. Subí un PDF, una imagen o un documento de Word.");
  });

  it("rechaza lo que supera los 15 MB", async () => {
    jest.spyOn(Imagenes, "bytesDe").mockResolvedValue(new Uint8Array(TAMANO_MAXIMO + 1));
    expect(await ArchivosUi.leer("file:///cache/grande.pdf", "grande.pdf")).toBeNull();
    expect(Avisos.estado.banner?.mensaje).toBe("El archivo supera los 15 MB");
  });

  it("avisa si no se puede leer", async () => {
    jest.spyOn(Imagenes, "bytesDe").mockRejectedValue(new Error("no existe"));
    expect(await ArchivosUi.leer("file:///cache/a.pdf", "a.pdf")).toBeNull();
    expect(Avisos.estado.carteles[0]?.mensaje).toBe("No se pudo leer el archivo elegido.");
  });

  it("elegir devuelve null si se cancela y el archivo si se elige uno", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await ArchivosUi.elegir()).toBeNull();

    jest.spyOn(Imagenes, "bytesDe").mockResolvedValue(new Uint8Array([9]));
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false, assets: [{ name: "receta.pdf", uri: "file:///cache/receta.pdf", size: 1, lastModified: 0 }],
    });
    const archivo = await ArchivosUi.elegir();
    expect(archivo?.nombre).toBe("receta.pdf");
    expect(DocumentPicker.getDocumentAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: expect.arrayContaining(["application/pdf", "image/png"]), copyToCacheDirectory: true }),
    );
  });

  it("elegir avisa sin leer si el selector ya informa más de 15 MB", async () => {
    const leer = jest.spyOn(Imagenes, "bytesDe");
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false, assets: [{ name: "grande.pdf", uri: "file:///x", size: TAMANO_MAXIMO + 5, lastModified: 0 }],
    });
    expect(await ArchivosUi.elegir()).toBeNull();
    expect(leer).not.toHaveBeenCalled();
    expect(Avisos.estado.banner?.mensaje).toBe("El archivo supera los 15 MB");
  });
});
