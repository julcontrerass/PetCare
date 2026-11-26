/*
 * Veterinarias: se registran con su CUIT, su director técnico y sus habilitaciones y pasan por la revisión del
 * administrador; quien la administra invita por DNI o correo con los roles que elige (o crea la cuenta de quien no
 * usa PetCare), la otra persona acepta o rechaza, y cualquiera puede salir. Un veterinario puede estar en varias.
 */
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { ClinicasRepo } from "../../src/data/repositorio/clinicasRepo";
import { Sesion } from "../../src/data/sesion";
import { resumenVeterinarias } from "../../src/ui/common/VeterinariasHoja";
import type { NuevaClinicaDto } from "../../src/data/remoto/dtos";

// Las habilitaciones "se suben" sin leer archivos: queda la ruta en la carpeta de quien las sube
jest.mock("../../src/data/habilitaciones", () => ({
  ...jest.requireActual("../../src/data/habilitaciones"),
  subirHabilitacion: jest.fn(async (a: { nombre: string }, usuario: string) => `${usuario}/habilitacion-${a.nombre}`),
}));

const HABILITACIONES = {
  comercial: { uri: "file:///comercial.pdf", nombre: "comercial.pdf" },
  sanitaria: { uri: "file:///sanitaria.jpg", nombre: "sanitaria.jpg" },
};
const DIRECTORA = { nombre: "Dra. Ana Gómez", dni: "27111222", matricula: "MP-777" };

function datos(nombre: string, director = DIRECTORA): NuevaClinicaDto {
  return { nombre, direccion: "Av. Siempreviva 742", telefono: "1144445555", cuit: "20-12345678-6", director };
}

const registrar = (nombre: string, director = DIRECTORA) => ClinicasRepo.crearClinica(datos(nombre, director), HABILITACIONES);

const VET = Escenario.veterinario();
const OTRO = Escenario.veterinario("vet-2", "Dra. Paz");
const LAURA = Escenario.perfil("recep-1", "dueno", "Laura Mostrador", { dni: "35111222" });
let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
  fuente.perfiles.push(VET, OTRO, LAURA);
});
afterEach(() => limpiarServicios());

async function cambiarA(perfil: typeof VET) {
  Sesion.olvidar();
  await ingresarComo(perfil);
}

describe("Veterinarias", () => {
  it("un veterinario registra otra veterinaria: titular y veterinario, también en revisión, y puede ser su director", async () => {
    await ingresarComo(VET);
    const id = await registrar("  San Roque ", { nombre: "Dr. Vera", dni: "28999888", matricula: "MP-100" });
    expect(fuente.llamadas).toContain("crearClinica:San Roque");
    expect(fuente.llamadas).toEqual(expect.arrayContaining([`cargarHabilitacionClinica:${id}:comercial`, `cargarHabilitacionClinica:${id}:sanitaria`]));
    expect(ClinicasRepo.clinica(id)?.roles).toEqual(["titular", "veterinario"]);
    expect(ClinicasRepo.enRevision(id)).toBe(true);
    expect(ClinicasRepo.administra(id)).toBe(false);
    expect(resumenVeterinarias()).toBe("San Roque");
    // Él es el director: no se invita a sí mismo
    expect(fuente.miembros.filter((m) => m.clinica_id === id)).toHaveLength(1);
  });

  it("si el director técnico usa PetCare, se lo reconoce por su matrícula y queda invitado al equipo", async () => {
    await ingresarComo(LAURA);
    const id = await registrar("Panda", { nombre: "Dr. Vera", dni: "11111111", matricula: "mp-100" });
    await cambiarA(VET);
    expect(ClinicasRepo.invitaciones.map((c) => [c.nombre, c.roles])).toEqual([["Panda", ["veterinario"]]]);
    await cambiarA(Escenario.admin());
    expect((await fuente.clinicasParaRevisar()).find((c) => c.id === id)?.director_en_petcare).toBe(true);
  });

  it("no se registra sin CUIT válido ni director técnico completo", async () => {
    await ingresarComo(LAURA);
    await expect(ClinicasRepo.crearClinica({ ...datos("Panda"), cuit: "123" }, HABILITACIONES)).rejects.toThrow("CUIT");
    await expect(ClinicasRepo.crearClinica(datos("Panda", { nombre: "Ana", dni: "1", matricula: "" }), HABILITACIONES))
      .rejects.toThrow("director técnico");
  });

  it("el administrador no aprueba si faltan las habilitaciones", async () => {
    await ingresarComo(LAURA);
    const id = await fuente.crearClinica({ ...datos("Panda"), cuit: "20123456786" });
    await cambiarA(Escenario.admin());
    const revisar = (await fuente.clinicasParaRevisar())[0];
    expect([revisar.cuit, revisar.director_matricula, revisar.habilitacion_comercial_path]).toEqual(["20123456786", "MP-777", null]);
    await expect(fuente.revisarClinica(id, true, null)).rejects.toThrow("Faltan datos");
  });

  it("si la rechazan, al volver a subir una habilitación vuelve a revisión", async () => {
    await ingresarComo(LAURA);
    const id = await registrar("Panda");
    await cambiarA(Escenario.admin());
    await fuente.revisarClinica(id, false, "La habilitación sanitaria está vencida");
    await cambiarA(LAURA);
    expect(ClinicasRepo.clinica(id)?.revision).toBe("rechazada");
    await ClinicasRepo.cargarHabilitacion(id, "sanitaria", { uri: "file:///nueva.pdf", nombre: "nueva.pdf" });
    expect(ClinicasRepo.clinica(id)?.revision).toBe("pendiente");
    expect(ClinicasRepo.clinica(id)?.falta_habilitacion_sanitaria).toBe(false);
  });

  it("quien no es veterinario registra su veterinaria: queda titular y en revisión, sin poder sumar a nadie", async () => {
    await ingresarComo(LAURA);
    const id = await registrar("Panda");
    expect(ClinicasRepo.clinica(id)?.roles).toEqual(["titular"]);
    expect(ClinicasRepo.enRevision(id)).toBe(true);
    expect(ClinicasRepo.administra(id)).toBe(false);
    // Lleva la veterinaria: usa el modo de la veterinaria aunque todavía no tenga veterinarios
    expect(ClinicasRepo.usaModoVeterinaria).toBe(true);
    expect(Sesion.rolesDisponibles).toContain("RECEPCIONISTA");
    await expect(ClinicasRepo.invitar(id, VET.email, ["veterinario"])).rejects.toThrow("titularidad o la administración");
  });

  it("el administrador aprueba la veterinaria y ahí la titular suma a su veterinario y ve su agenda", async () => {
    await ingresarComo(LAURA);
    const id = await registrar("Panda");
    await cambiarA(Escenario.admin());
    expect((await fuente.clinicasParaRevisar()).map((c) => [c.nombre, c.titular_nombre])).toEqual([["Panda", "Laura Mostrador"]]);
    await expect(fuente.revisarClinica(id, false, "")).rejects.toThrow("motivo");
    await fuente.revisarClinica(id, true, null);
    expect(await fuente.clinicasParaRevisar()).toHaveLength(0);

    await cambiarA(LAURA);
    expect(ClinicasRepo.administra(id)).toBe(true);
    await ClinicasRepo.invitar(id, VET.email, ["veterinario"]);
    await cambiarA(VET);
    await ClinicasRepo.responder(ClinicasRepo.invitaciones[0], true);
    await cambiarA(LAURA);
    expect(ClinicasRepo.veterinariosConAgenda).toEqual([VET.id]);
  });

  it("una veterinaria rechazada muestra el motivo", async () => {
    await ingresarComo(LAURA);
    const id = await registrar("Panda");
    await cambiarA(Escenario.admin());
    await fuente.revisarClinica(id, false, "No pudimos verificar que exista");
    await cambiarA(LAURA);
    expect(ClinicasRepo.clinica(id)?.revision).toBe("rechazada");
    expect(ClinicasRepo.clinica(id)?.motivo_revision).toBe("No pudimos verificar que exista");
    expect(ClinicasRepo.administra(id)).toBe(false);
  });

  it("la veterinaria le crea la cuenta a un veterinario, que queda en revisión y sin agenda hasta que lo aprueben", async () => {
    fuente.agregarClinica("cli-p", "Panda", [[LAURA.id, ["titular"]]]);
    await ingresarComo(LAURA);
    await expect(ClinicasRepo.crearCuenta({
      clinica_id: "cli-p", roles: ["veterinario"], nombre: "Dra. Nueva", dni: "30111222", telefono: "1144445555", email: "nueva@prueba.test",
    })).rejects.toThrow("matrícula");
    const creada = await ClinicasRepo.crearCuenta({
      clinica_id: "cli-p", roles: ["veterinario"], nombre: " Dra. Nueva ", dni: "30111222", telefono: "1144445555",
      email: "nueva@prueba.test", matricula: " MP-900 ", credencial: "AAAA",
    });
    expect(creada.en_revision).toBe(true);
    expect(fuente.llamadas).toContain("crearCuentaMiembro:nueva@prueba.test");
    expect((await ClinicasRepo.equipo("cli-p")).map((m) => [m.nombre, m.roles])).toEqual([["Laura Mostrador", ["titular"]], ["Dra. Nueva", ["veterinario"]]]);
    expect(ClinicasRepo.veterinariosConAgenda).toEqual([]);
  });

  it("la titular invita a recepción y la invitación le aparece a la otra persona al entrar", async () => {
    fuente.agregarClinica("cli-s", "San Roque", [[VET.id, ["titular", "veterinario"]]]);
    await ingresarComo(VET);
    const id = "cli-s";
    expect(await ClinicasRepo.invitar(id, ` ${LAURA.email} `, ["recepcion"])).toBe("Laura Mostrador");

    await cambiarA(LAURA);
    expect(ClinicasRepo.invitaciones.map((c) => [c.nombre, c.roles, c.invitado_por_nombre])).toEqual([["San Roque", ["recepcion"], "Dr. Vera"]]);
    expect(resumenVeterinarias()).toBe("1 invitación");
    expect(Sesion.rolesDisponibles).toEqual(["DUENO"]);

    await ClinicasRepo.responder(ClinicasRepo.invitaciones[0], true);
    expect(ClinicasRepo.invitaciones).toHaveLength(0);
    expect(ClinicasRepo.agendas.map((a) => a.veterinario_id)).toEqual([VET.id]);
    expect(Sesion.rolesDisponibles).toEqual(["DUENO", "RECEPCIONISTA"]);
  });

  it("un veterinario puede estar en varias veterinarias con distintos roles", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]]]);
    fuente.agregarClinica("cli-b", "Norte", [[OTRO.id, ["titular", "veterinario"]]]);
    await ingresarComo(OTRO);
    await ClinicasRepo.invitar("cli-b", VET.email, ["veterinario", "administrador"]);
    await cambiarA(VET);
    await ClinicasRepo.responder(ClinicasRepo.invitaciones[0], true);
    expect(ClinicasRepo.activas.map((c) => [c.nombre, c.roles])).toEqual([
      ["Centro", ["titular", "veterinario"]], ["Norte", ["veterinario", "administrador"]],
    ]);
    expect(resumenVeterinarias()).toBe("2 veterinarias");
    // Como administra Norte, maneja la agenda de la Dra. Paz
    expect(ClinicasRepo.veterinariosConAgenda).toEqual([OTRO.id]);
  });

  it("solo un veterinario aprobado puede tener el rol de veterinario o titular", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]]]);
    await ingresarComo(VET);
    await expect(ClinicasRepo.invitar("cli-a", LAURA.email, ["veterinario"])).rejects.toThrow("Solo un veterinario con la cuenta aprobada");
  });

  it("administración invita pero no puede sumar titulares; recepción no maneja el equipo", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]], [LAURA.id, ["administrador"]]]);
    await ingresarComo(LAURA);
    expect(ClinicasRepo.administra("cli-a")).toBe(true);
    expect(ClinicasRepo.esTitular("cli-a")).toBe(false);
    await expect(ClinicasRepo.invitar("cli-a", OTRO.email, ["titular"])).rejects.toThrow("Solo un titular");
    await ClinicasRepo.invitar("cli-a", OTRO.email, ["veterinario"]);

    fuente.miembros.find((m) => m.cuenta_id === LAURA.id)!.roles = ["recepcion"];
    await ClinicasRepo.cargar();
    expect(ClinicasRepo.administra("cli-a")).toBe(false);
  });

  it("no se invita dos veces ni a alguien sin cuenta", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]], [LAURA.id, ["recepcion"]]]);
    await ingresarComo(VET);
    await expect(ClinicasRepo.invitar("cli-a", LAURA.email, ["recepcion"])).rejects.toThrow("ya está en el equipo");
    await expect(ClinicasRepo.invitar("cli-a", "nadie@prueba.test", ["recepcion"])).rejects.toThrow("No encontramos una cuenta");
  });

  it("cambia roles, saca personas y la veterinaria nunca queda sin titular", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]], [LAURA.id, ["recepcion"]]]);
    await ingresarComo(VET);
    const equipo = await ClinicasRepo.equipo("cli-a");
    expect(equipo.map((m) => [m.nombre, m.es_yo])).toEqual([["Dr. Vera", true], ["Laura Mostrador", false]]);
    const yo = equipo[0];
    const laura = equipo[1];
    await ClinicasRepo.cambiarRoles(laura.miembro_id, ["recepcion", "administrador"]);
    expect(fuente.miembros.find((m) => m.id === laura.miembro_id)!.roles).toEqual(["recepcion", "administrador"]);
    await expect(ClinicasRepo.cambiarRoles(yo.miembro_id, ["veterinario"])).rejects.toThrow("al menos un titular");
    await expect(ClinicasRepo.quitar(yo.miembro_id)).rejects.toThrow("al menos un titular");
    await ClinicasRepo.quitar(laura.miembro_id);
    expect((await ClinicasRepo.equipo("cli-a")).map((m) => m.nombre)).toEqual(["Dr. Vera"]);
  });

  it("quien está en recepción puede salir por su cuenta", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]], [LAURA.id, ["recepcion"]]]);
    await ingresarComo(LAURA);
    expect(Sesion.rol).toBe("RECEPCIONISTA");
    await ClinicasRepo.quitar(ClinicasRepo.activas[0].miembro_id);
    expect(ClinicasRepo.activas).toHaveLength(0);
    expect(ClinicasRepo.agendas).toHaveLength(0);
  });

  it("quien administra crea la cuenta y queda en el equipo al instante", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]]]);
    await ingresarComo(VET);
    const creada = await ClinicasRepo.crearCuenta({
      clinica_id: "cli-a", roles: ["recepcion"], nombre: " Carla Caja ", dni: "36111222", telefono: "1144445555", email: " Carla@Prueba.test ",
    });
    expect(fuente.llamadas).toContain("crearCuentaMiembro:carla@prueba.test");
    expect(creada.password_temporal).toBe("Temp#1234");
    expect((await ClinicasRepo.equipo("cli-a")).map((m) => [m.nombre, m.estado])).toEqual([["Dr. Vera", "activo"], ["Carla Caja", "activo"]]);
  });

  it("si el servidor rechaza la cuenta, el error llega tal cual", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]]]);
    await ingresarComo(VET);
    fuente.errorAlCrearCuenta = "Ese DNI ya tiene una cuenta en PetCare. Invitalo/a con su DNI o su correo.";
    await expect(ClinicasRepo.crearCuenta({
      clinica_id: "cli-a", roles: ["recepcion"], nombre: "Laura Mostrador", dni: "35111222", telefono: "1144445555", email: "laura@prueba.test",
    })).rejects.toThrow("Ese DNI ya tiene una cuenta");
  });

  it("la vista de la veterinaria muestra la que la cuenta lleva, con su logo", async () => {
    fuente.agregarClinica("cli-p", "Panda", [[LAURA.id, ["titular"]]]);
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]], [LAURA.id, ["veterinario"]]]);
    await ingresarComo(LAURA);
    expect(ClinicasRepo.principal?.nombre).toBe("Panda");
    await fuente.cambiarLogoClinica("cli-p", `${LAURA.id}/logo.jpg`);
    await ClinicasRepo.cargar();
    expect(ClinicasRepo.principal?.logo_path).toBe(`${LAURA.id}/logo.jpg`);
  });

  it("el logo lo cambian el titular o la administración (aunque esté en revisión), con la imagen en su carpeta", async () => {
    await ingresarComo(LAURA);
    const id = await registrar("Panda");
    await expect(fuente.cambiarLogoClinica(id, "otra-cuenta/logo.jpg")).rejects.toThrow("tu carpeta");
    await fuente.cambiarLogoClinica(id, `${LAURA.id}/logo.jpg`);
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]], [LAURA.id, ["recepcion"]]]);
    await expect(fuente.cambiarLogoClinica("cli-a", `${LAURA.id}/logo.jpg`)).rejects.toThrow("titular o la administración");
  });

  it("al cerrar la sesión se olvidan las veterinarias", async () => {
    fuente.agregarClinica("cli-a", "Centro", [[VET.id, ["titular", "veterinario"]]]);
    await ingresarComo(VET);
    Sesion.olvidar();
    expect(ClinicasRepo.activas).toHaveLength(0);
  });
});
