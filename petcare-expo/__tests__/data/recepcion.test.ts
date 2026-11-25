/*
 * Vínculos de recepción: el veterinario invita (o la otra cuenta pide), el otro lado acepta o rechaza, cualquiera
 * de los dos lo corta, y las invitaciones aparecen solas al entrar.
 */
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { Registro } from "../../src/data/registro";
import { RecepcionRepo } from "../../src/data/repositorio/recepcionRepo";
import { Sesion } from "../../src/data/sesion";
import { resumenRecepcion } from "../../src/ui/common/RecepcionHoja";

const VET = Escenario.veterinario();
const DUENA = Escenario.dueno();
let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
  fuente.perfiles.push(VET, DUENA);
});
afterEach(() => limpiarServicios());

async function cambiarA(perfil: typeof VET) {
  Sesion.olvidar();
  await ingresarComo(perfil);
}

describe("Recepción", () => {
  it("el veterinario invita por correo y la invitación le aparece a la otra cuenta al entrar", async () => {
    await ingresarComoVeterinario();
    expect(await RecepcionRepo.invitar(`  ${DUENA.email} `)).toBe("pendiente");
    expect(fuente.llamadas).toContain(`invitarRecepcionista:${DUENA.email}`);
    expect(RecepcionRepo.miRecepcion.map((v) => [v.nombre, v.estado, v.me_toca_responder])).toEqual([["Ana Prueba", "pendiente", false]]);
    expect(resumenRecepcion("veterinario")).toBe("Nadie todavía");

    await cambiarA(DUENA);
    expect(RecepcionRepo.invitacionesRecibidas.map((v) => [v.nombre, v.clinica])).toEqual([["Dr. Vera", "Clínica Sur"]]);
  });

  it("al aceptar queda activo de los dos lados y la invitación desaparece del Inicio", async () => {
    await ingresarComoVeterinario();
    await RecepcionRepo.invitar(DUENA.email);
    await cambiarA(DUENA);
    await RecepcionRepo.responder(RecepcionRepo.invitacionesRecibidas[0], true);
    expect(RecepcionRepo.invitacionesRecibidas).toHaveLength(0);
    expect(RecepcionRepo.misVeterinarios.map((v) => v.estado)).toEqual(["activo"]);
    expect(resumenRecepcion("recepcionista")).toBe("1 veterinario");

    await cambiarA(VET);
    expect(resumenRecepcion("veterinario")).toBe("1 persona");
  });

  it("la otra cuenta pide por matrícula y el veterinario lo ve para responder", async () => {
    await ingresarComoDueno();
    expect(await RecepcionRepo.pedir("mp-100")).toBe("pendiente");
    expect(RecepcionRepo.misVeterinarios.map((v) => [v.nombre, v.me_toca_responder])).toEqual([["Dr. Vera", false]]);

    await cambiarA(VET);
    expect(RecepcionRepo.pedidosRecibidos.map((v) => v.nombre)).toEqual(["Ana Prueba"]);
    expect(resumenRecepcion("veterinario")).toBe("Nadie todavía · 1 para responder");
    await RecepcionRepo.responder(RecepcionRepo.pedidosRecibidos[0], false);
    expect(RecepcionRepo.miRecepcion).toHaveLength(0);
  });

  it("si los dos lo piden, el segundo pedido lo deja activo en el momento", async () => {
    await ingresarComoDueno();
    await RecepcionRepo.pedir(VET.email);
    await cambiarA(VET);
    expect(await RecepcionRepo.invitar(DUENA.email)).toBe("activo");
    expect(RecepcionRepo.miRecepcion.map((v) => v.estado)).toEqual(["activo"]);
  });

  it("quien inició no puede aceptarse a sí mismo", async () => {
    await ingresarComoVeterinario();
    await RecepcionRepo.invitar(DUENA.email);
    await expect(RecepcionRepo.responder(RecepcionRepo.miRecepcion[0], true)).rejects.toThrow("El pedido ya no está disponible");
  });

  it("no se puede invitar sin ser veterinario, a uno mismo ni a alguien sin cuenta", async () => {
    await ingresarComoDueno();
    await expect(RecepcionRepo.invitar(VET.email)).rejects.toThrow("Solo un veterinario activo");
    await cambiarA(VET);
    await expect(RecepcionRepo.invitar(VET.email)).rejects.toThrow("No podés ser tu propio recepcionista");
    await expect(RecepcionRepo.invitar("nadie@prueba.test")).rejects.toThrow("No encontramos una cuenta");
  });

  it("cualquiera de los dos corta el vínculo", async () => {
    await ingresarComoVeterinario();
    await RecepcionRepo.invitar(DUENA.email);
    await cambiarA(DUENA);
    await RecepcionRepo.responder(RecepcionRepo.invitacionesRecibidas[0], true);
    await RecepcionRepo.quitar(RecepcionRepo.misVeterinarios[0]);
    expect(RecepcionRepo.misVeterinarios).toHaveLength(0);
    expect(fuente.recepcion).toHaveLength(0);
  });

  it("el registro como recepcionista confirma al veterinario y manda su dato con la cuenta", async () => {
    expect(await Registro.buscarVeterinario(" mp-100 ")).toEqual({ nombre: "Dr. Vera", clinica: "Clínica Sur" });
    expect(await Registro.buscarVeterinario(VET.email)).not.toBeNull();
    // Sin sesión no se encuentra a nadie por su DNI
    expect(await Registro.buscarVeterinario("28999888")).toBeNull();

    await Registro.recepcionista({
      nombre: "Laura Mostrador", dni: "35111222", telefono: "1144445555", email: "laura@prueba.test", password: "secreta",
      fotoPath: null, recepcionDe: "MP-100",
    });
    expect(fuente.llamadas).toContain("registrar:laura@prueba.test");
    expect(fuente.ultimosDatosDeRegistro).toMatchObject({ rol: "dueno", nombre: "Laura Mostrador", recepcion_de: "MP-100", mascotas: [] });
  });

  it("sin veterinario el registro no manda recepcion_de", async () => {
    await Registro.recepcionista({
      nombre: "Laura Mostrador", dni: "35111222", telefono: "1144445555", email: "laura@prueba.test", password: "secreta",
      fotoPath: null, recepcionDe: null,
    });
    expect(fuente.ultimosDatosDeRegistro).not.toHaveProperty("recepcion_de");
  });

  it("el veterinario crea la cuenta y queda en su recepción al instante", async () => {
    await ingresarComoVeterinario();
    const creada = await RecepcionRepo.crearCuenta({ nombre: " Laura Mostrador ", dni: "35111222", telefono: "1144445555", email: " Laura@Prueba.test " });
    expect(fuente.llamadas).toContain("crearCuentaRecepcionista:laura@prueba.test");
    expect(creada.password_temporal).toBe("Temp#1234");
    expect(RecepcionRepo.miRecepcion.map((v) => [v.nombre, v.estado])).toEqual([["Laura Mostrador", "activo"]]);
    expect(resumenRecepcion("veterinario")).toBe("1 persona");
  });

  it("si el servidor rechaza la cuenta, el error llega tal cual", async () => {
    await ingresarComoVeterinario();
    fuente.errorAlCrearCuenta = "Ese DNI ya tiene una cuenta en PetCare. Invitalo/a con su DNI o su correo.";
    await expect(RecepcionRepo.crearCuenta({ nombre: "Laura Mostrador", dni: "35111222", telefono: "1144445555", email: "laura@prueba.test" }))
      .rejects.toThrow("Ese DNI ya tiene una cuenta");
    expect(RecepcionRepo.miRecepcion).toHaveLength(0);
  });

  it("al cerrar la sesión se olvidan los vínculos", async () => {
    await ingresarComoVeterinario();
    await RecepcionRepo.invitar(DUENA.email);
    expect(RecepcionRepo.vinculos).toHaveLength(1);
    Sesion.olvidar();
    expect(RecepcionRepo.vinculos).toHaveLength(0);
  });
});
