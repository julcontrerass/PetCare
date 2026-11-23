/* Migrado de ContactoTest.kt (+ los atajos que arman direcciones). */
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));

import { Linking } from "react-native";
import { LocalDate } from "../../src/util/tiempo";
import { Avisos } from "../../src/ui/common/Avisos";
import { Contacto } from "../../src/ui/common/Contacto";

describe("Contacto", () => {
  beforeEach(() => Avisos.reiniciar());
  afterEach(() => {
    Avisos.reiniciar();
    jest.restoreAllMocks();
  });

  it("el mensaje de acceso lleva los datos para ingresar", () => {
    const mensaje = Contacto.mensajeDeAcceso("Carlos Gómez", ["Toby"], "carlos@prueba.test", "Temp1234ab", "Dra. Vera", "Clínica Sur");

    expect(mensaje.startsWith("Hola Carlos, soy Dra. Vera de Clínica Sur.")).toBe(true);
    expect(mensaje).toContain("la ficha de Toby");
    expect(mensaje).toContain("Correo: carlos@prueba.test");
    expect(mensaje).toContain("Contraseña temporal: Temp1234ab");
  });

  it("el mensaje de acceso nombra varias mascotas y funciona sin clínica", () => {
    const mensaje = Contacto.mensajeDeAcceso("Ana", ["Toby", "Luna", "Rex"], "a@b.co", "x", "Dr. Pérez", "");

    expect(mensaje).toContain("soy Dr. Pérez.");
    expect(mensaje).toContain("la ficha de Toby, Luna y Rex");
  });

  it("el mensaje de acceso sin mascotas ni veterinario usa los textos genéricos", () => {
    const mensaje = Contacto.mensajeDeAcceso("Ana", [], "a@b.co", "x", " ", "");
    expect(mensaje).toContain("soy tu veterinario.");
    expect(mensaje).toContain("la ficha de tus mascotas");
  });

  it("whatsApp arma el número de celular argentino", () => {
    expect(Contacto.numeroWhatsApp("11 1234-5678")).toBe("5491112345678");
    expect(Contacto.numeroWhatsApp("011 15 1234 5678")).toBe("5491112345678");
    expect(Contacto.numeroWhatsApp("+54 9 11 1234 5678")).toBe("5491112345678");
    expect(Contacto.numeroWhatsApp("+54 11 1234 5678")).toBe("5491112345678");
  });

  it("whatsApp sin número usable devuelve null", () => {
    expect(Contacto.numeroWhatsApp("Sin datos")).toBeNull();
    expect(Contacto.numeroWhatsApp("123")).toBeNull();
    expect(Contacto.whatsApp("Sin datos", "Hola")).toBeNull();
  });

  it("whatsApp arma la dirección de wa.me con el mensaje codificado", () => {
    expect(Contacto.whatsApp("11 1234-5678", "Hola Ana, ¿cómo estás?")).toBe(
      "https://wa.me/5491112345678?text=" + encodeURIComponent("Hola Ana, ¿cómo estás?"),
    );
  });

  it("llamar y correo arman tel: y mailto:", () => {
    expect(Contacto.llamar("(011) 4444-5555")).toBe("tel:01144445555");
    expect(Contacto.llamar("+54 11 4444 5555")).toBe("tel:+541144445555");
    expect(Contacto.llamar("123")).toBeNull();
    expect(Contacto.correo("ana@prueba.test")).toBe("mailto:ana@prueba.test");
  });

  it("los mensajes para el dueño de un paciente", () => {
    expect(Contacto.mensajeDeSaludo("Ana Prueba", "Rex")).toBe("Hola Ana, te escribo por Rex.");
    expect(Contacto.mensajeDeSaludo("Sin datos", "Rex")).toBe("Hola, te escribo por Rex.");
    const hoy = LocalDate.of(2026, 10, 12);
    const vencida = Contacto.mensajeDeRevision("Ana Prueba", "Clínica Sur", "Rex", "vacuna", "Antirrábica", LocalDate.of(2026, 10, 1), hoy);
    expect(vencida).toBe(
      "Hola Ana, te escribo de Clínica Sur. A Rex la vacuna Antirrábica venció el 01 Oct 2026. ¿Querés que te saque un turno para aplicarla?",
    );
    const proxima = Contacto.mensajeDeRevision("Sin datos", "", "Rex", "vacuna", "Antirrábica", LocalDate.of(2026, 10, 20), hoy);
    expect(proxima).toContain("Hola, te escribo de la veterinaria.");
    expect(proxima).toContain("le toca el 20 Oct 2026");
  });

  it("abrir avisa cuando no hay datos y abre la dirección con Linking", async () => {
    await Contacto.abrir(null, "No hay un teléfono cargado");
    expect(Avisos.estado.banner?.mensaje).toBe("No hay un teléfono cargado");

    const abrirUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await Contacto.abrir("tel:1144445555", "-");
    expect(abrirUrl).toHaveBeenCalledWith("tel:1144445555");
  });

  it("abrir avisa si no hay aplicación disponible", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("sin app"));
    await Contacto.abrir("mailto:a@b.co", "-");
    expect(Avisos.estado.banner?.mensaje).toBe("No hay una aplicación disponible para esta acción");
  });
});
