/* Co-dueños de una mascota: invitar por DNI o correo, aceptar o rechazar, ver la mascota compartida y dejar de serlo. */
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, ingresarComoDueno, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { Sesion } from "../../src/data/sesion";

const PAREJA = Escenario.perfil("dueno-2", "dueno", "Bruno Pareja", { dni: "31222333" });
let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
  fuente.perfiles.push(PAREJA, Escenario.dueno());
  fuente.mascotas.push(Escenario.mascota("m-luna", "Luna"));
});
afterEach(() => limpiarServicios());

async function invitarALaPareja(dato: string = PAREJA.email): Promise<string> {
  await ingresarComoDueno();
  const luna = DuenoRepo.mascotas.find((m) => m.nombre === "Luna")!;
  return DuenoRepo.invitarCodueno(luna, dato);
}

async function entrarComoPareja() {
  Sesion.olvidar();
  await ingresarComo(PAREJA);
}

describe("Co-dueños", () => {
  it("las mascotas propias no están marcadas como compartidas", async () => {
    await ingresarComoDueno();
    expect(DuenoRepo.mascotas.map((m) => [m.nombre, m.compartida])).toEqual([["Luna", false]]);
  });

  it("se invita por correo o por DNI y devuelve el nombre de la persona", async () => {
    expect(await invitarALaPareja(`  ${PAREJA.email.toUpperCase()} `)).toBe("Bruno Pareja");
    expect(fuente.llamadas).toContain(`invitarCodueno:m-luna:${PAREJA.email.toUpperCase()}`);
    fuente.coduenos = [];
    expect(await DuenoRepo.invitarCodueno(DuenoRepo.mascotas[0], "31222333")).toBe("Bruno Pareja");
  });

  it("no se puede invitar a uno mismo ni a alguien sin cuenta", async () => {
    await ingresarComoDueno();
    const luna = DuenoRepo.mascotas[0];
    await expect(DuenoRepo.invitarCodueno(luna, Escenario.dueno().email)).rejects.toThrow("No podés invitarte a vos mismo");
    await expect(DuenoRepo.invitarCodueno(luna, "nadie@prueba.test")).rejects.toThrow("No encontramos una cuenta");
  });

  it("la persona invitada no ve la mascota hasta aceptar; al aceptar la ve como compartida", async () => {
    await invitarALaPareja();
    await entrarComoPareja();
    expect(DuenoRepo.mascotas).toHaveLength(0);
    expect(DuenoRepo.invitaciones.map((i) => [i.mascota_nombre, i.invitado_por_nombre])).toEqual([["Luna", "Ana Prueba"]]);

    await DuenoRepo.responderInvitacion(DuenoRepo.invitaciones[0], true);
    expect(DuenoRepo.invitaciones).toHaveLength(0);
    const luna = DuenoRepo.mascotas.find((m) => m.nombre === "Luna")!;
    expect(luna.compartida).toBe(true);
    const duenos = await DuenoRepo.duenosDe(luna);
    expect(duenos.map((d) => [d.nombre, d.es_original, d.estado])).toEqual([
      ["Ana Prueba", true, "activo"],
      ["Bruno Pareja", false, "activo"],
    ]);
  });

  it("al rechazar, la invitación desaparece y la mascota no se suma", async () => {
    await invitarALaPareja();
    await entrarComoPareja();
    await DuenoRepo.responderInvitacion(DuenoRepo.invitaciones[0], false);
    expect(DuenoRepo.invitaciones).toHaveLength(0);
    expect(DuenoRepo.mascotas).toHaveLength(0);
    expect(fuente.coduenos).toHaveLength(0);
  });

  it("el co-dueño puede dejar de serlo y deja de ver la mascota", async () => {
    await invitarALaPareja();
    await entrarComoPareja();
    await DuenoRepo.responderInvitacion(DuenoRepo.invitaciones[0], true);
    const luna = DuenoRepo.mascotas[0];
    const propia = (await DuenoRepo.duenosDe(luna)).find((d) => d.usuario_id === PAREJA.id)!;
    await DuenoRepo.dejarDeSerDueno(luna, propia.codueno_id!);
    expect(DuenoRepo.mascotas).toHaveLength(0);
    expect(fuente.llamadas).toContain(`quitarCodueno:${propia.codueno_id}`);
  });

  it("si el dueño original lo quita, la mascota desaparece en la próxima recarga del co-dueño", async () => {
    await invitarALaPareja();
    await entrarComoPareja();
    await DuenoRepo.responderInvitacion(DuenoRepo.invitaciones[0], true);
    expect(DuenoRepo.mascotas).toHaveLength(1);
    fuente.coduenos = [];
    await DuenoRepo.recargarDerivados();
    expect(DuenoRepo.mascotas).toHaveLength(0);
  });
});
