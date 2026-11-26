/*
 * Modo recepción: cuándo se ofrece al ingresar, qué agenda ve (solo la de los veterinarios de sus veterinarias) y qué le manda
 * al servidor al sacar, mover y cancelar turnos y al marcar la llegada.
 */
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { RecepcionAgendaRepo } from "../../src/data/repositorio/recepcionAgendaRepo";
import { ClinicasRepo } from "../../src/data/repositorio/clinicasRepo";
import { Sesion } from "../../src/data/sesion";
import { Fechas } from "../../src/util/fechas";
import { LocalDate } from "../../src/util/tiempo";

const VERA = Escenario.veterinario();
const OTRO = Escenario.veterinario("vet-2", "Dra. Paz");
const AJENO = Escenario.veterinario("vet-3", "Dr. Ajeno");
const LAURA = Escenario.perfil("recep-1", "dueno", "Laura Mostrador", { dni: "35111222" });
const DUENA = Escenario.dueno();
let fuente: FuenteEnMemoria;

/** El próximo día en que atiende Vera (lunes a viernes, 9 a 12). */
function proximoDiaHabil(): LocalDate {
  let d = LocalDate.now().plusDays(1);
  while (d.dayOfWeek > 5) d = d.plusDays(1);
  return d;
}

/** Laura en la recepción de la veterinaria de [vet] (cada veterinario con la suya, como queda al migrar). */
function vincular(vet: string, estado: "activo" | "pendiente" = "activo") {
  fuente.agregarClinica(`cli-${vet}`, `Veterinaria de ${vet}`, [[vet, ["titular", "veterinario"]], [LAURA.id, ["recepcion"], estado]]);
}

beforeEach(() => {
  fuente = prepararServicios();
  fuente.perfiles.push(VERA, OTRO, AJENO, LAURA, DUENA);
  fuente.mascotas.push(Escenario.mascota("m-luna", "Luna"), Escenario.mascota("m-tom", "Tom", Escenario.DUENO_ID, "Gato"));
  fuente.accesosGuardados.push(
    { id: "a1", mascota_id: "m-luna", veterinario_id: VERA.id, estado: "activo", iniciado_por: "dueno" },
    { id: "a2", mascota_id: "m-tom", veterinario_id: AJENO.id, estado: "activo", iniciado_por: "dueno" },
  );
  const dia = proximoDiaHabil().toString();
  fuente.turnosGuardados.push(
    Escenario.turno("t-vera", "m-luna", dia, "10:00:00", VERA.id),
    Escenario.turno("t-ajeno", "m-tom", dia, "10:00:00", AJENO.id),
  );
});
afterEach(() => limpiarServicios());

describe("Modo recepción", () => {
  it("quien solo trabaja en recepción, sin mascotas propias, entra directo a la recepción", async () => {
    vincular(VERA.id);
    const r = await ingresarComo(LAURA);
    expect(r).toEqual({ tipo: "listo", rol: "RECEPCIONISTA" });
    expect(Sesion.rolesDisponibles).toEqual(["DUENO", "RECEPCIONISTA"]);
  });

  it("con mascotas propias pregunta cómo ingresar", async () => {
    vincular(VERA.id);
    fuente.mascotas.push(Escenario.mascota("m-propia", "Rocky", LAURA.id));
    const r = await ingresarComo(LAURA);
    expect(r).toEqual({ tipo: "elegir", roles: ["DUENO", "RECEPCIONISTA"] });
  });

  it("sin ningún vínculo no se ofrece la recepción", async () => {
    const r = await ingresarComo(LAURA);
    expect(r).toEqual({ tipo: "listo", rol: "DUENO" });
  });

  it("con una invitación sin responder entra como dueño y la ve en el Inicio", async () => {
    vincular(VERA.id, "pendiente");
    const r = await ingresarComo(LAURA);
    expect(r).toEqual({ tipo: "listo", rol: "DUENO" });
    expect(ClinicasRepo.invitaciones.map((c) => c.nombre)).toEqual(["Veterinaria de vet-1"]);
    expect(RecepcionAgendaRepo.proximos()).toHaveLength(0);
  });

  it("en una veterinaria con varios veterinarios ve la agenda de todos, y un veterinario puede estar en varias", async () => {
    fuente.agregarClinica("cli-centro", "Centro", [[VERA.id, ["titular", "veterinario"]], [OTRO.id, ["veterinario"]], [LAURA.id, ["recepcion"]]]);
    // Vera también atiende en otra veterinaria donde Laura no está
    fuente.agregarClinica("cli-norte", "Norte", [[VERA.id, ["veterinario"]], [AJENO.id, ["titular", "veterinario"]]]);
    await ingresarComo(LAURA);
    expect(RecepcionAgendaRepo.veterinarios.map((v) => v.nombre)).toEqual(["Dr. Vera", "Dra. Paz"]);
    expect(RecepcionAgendaRepo.proximos().map((t) => t.id)).toEqual(["t-vera"]);
  });

  it("administración también maneja la agenda; un veterinario sin otro rol no ve la de sus colegas", async () => {
    fuente.agregarClinica("cli-centro", "Centro", [[VERA.id, ["titular", "veterinario"]], [OTRO.id, ["veterinario"]], [LAURA.id, ["administrador"]]]);
    expect((await ingresarComo(LAURA))).toEqual({ tipo: "listo", rol: "RECEPCIONISTA" });
    fuente.yo = OTRO;
    expect(await fuente.agendasQueManejo()).toEqual([]);
  });

  it("ve solo los turnos y pacientes de sus veterinarios activos", async () => {
    vincular(VERA.id);
    vincular(OTRO.id);
    await ingresarComo(LAURA);
    expect(RecepcionAgendaRepo.veterinarios.map((v) => v.nombre)).toEqual(["Dr. Vera", "Dra. Paz"]);
    expect(RecepcionAgendaRepo.proximos().map((t) => t.id)).toEqual(["t-vera"]);
    expect(RecepcionAgendaRepo.pacientes(VERA.id).map((p) => [p.nombre, p.dueno])).toEqual([["Luna", "Ana Prueba"]]);
    expect(RecepcionAgendaRepo.pacientes(OTRO.id)).toHaveLength(0);
  });

  it("los horarios que se pisan con otro turno del veterinario aparecen ocupados", async () => {
    vincular(VERA.id);
    await ingresarComo(LAURA);
    const vera = RecepcionAgendaRepo.veterinario(VERA.id)!;
    const { horas, ocupadas } = RecepcionAgendaRepo.horarios(vera, proximoDiaHabil(), 30, null);
    expect(horas).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    expect(ocupadas).toEqual(["10:00"]);
    // Moviendo ese mismo turno, su propio horario queda libre
    expect(RecepcionAgendaRepo.horarios(vera, proximoDiaHabil(), 30, null, "t-vera").ocupadas).toEqual([]);
  });

  it("saca un turno a nombre del veterinario y queda creado por la recepción", async () => {
    vincular(VERA.id);
    await ingresarComo(LAURA);
    const dia = proximoDiaHabil();
    await RecepcionAgendaRepo.sacarTurno({
      vetId: VERA.id, mascotaId: "m-luna", tipo: "Vacunación", motivo: "", fecha: dia, hora: "11:00", sedeId: null, notas: "",
    });
    const nuevo = fuente.turnosGuardados.find((t) => t.hora === "11:00:00")!;
    expect(nuevo).toMatchObject({ veterinario_id: VERA.id, mascota_id: "m-luna", categoria: "Vacunación", motivo: "Vacunación" });
    expect(RecepcionAgendaRepo.proximos().map((t) => t.hora)).toEqual(["10:00", "11:00"]);
  });

  it("mueve, marca la llegada y cancela", async () => {
    vincular(VERA.id);
    await ingresarComo(LAURA);
    const t = RecepcionAgendaRepo.turno("t-vera")!;
    await RecepcionAgendaRepo.mover(t, {
      vetId: VERA.id, mascotaId: "m-luna", tipo: t.tipo, motivo: t.motivo, fecha: t.fecha, hora: "11:30", sedeId: null, notas: "",
    });
    expect(RecepcionAgendaRepo.turno("t-vera")!.hora).toBe("11:30");

    await RecepcionAgendaRepo.marcarLlegada(RecepcionAgendaRepo.turno("t-vera")!, "en_espera");
    expect(fuente.llamadas).toContain("turno:t-vera:llegada=en_espera");
    expect(RecepcionAgendaRepo.turno("t-vera")!.llegada).toBe("en_espera");

    await RecepcionAgendaRepo.cancelar(RecepcionAgendaRepo.turno("t-vera")!);
    expect(RecepcionAgendaRepo.proximos()).toHaveLength(0);
    expect(RecepcionAgendaRepo.porEstado("CANCELADO").map((x) => x.id)).toEqual(["t-vera"]);
  });

  it("si la recepción se suma después de ingresar como dueño, puede pasar a ese modo", async () => {
    await ingresarComo(LAURA);
    expect(Sesion.rolesDisponibles).toEqual(["DUENO"]);
    vincular(VERA.id);
    await ClinicasRepo.cargar();
    expect(Sesion.rolesDisponibles).toEqual(["DUENO", "RECEPCIONISTA"]);
    await Sesion.cambiarModo("RECEPCIONISTA");
    expect(RecepcionAgendaRepo.veterinarios.map((v) => v.nombre)).toEqual(["Dr. Vera"]);
  });

  it("en el modo recepción, aceptar una invitación muestra la agenda de esa veterinaria en el momento", async () => {
    vincular(OTRO.id);
    fuente.agregarClinica("cli-inv", "Otra", [[VERA.id, ["titular", "veterinario"]], [LAURA.id, ["recepcion"], "pendiente"]]);
    await ingresarComo(LAURA);
    expect(Sesion.rol).toBe("RECEPCIONISTA");
    expect(RecepcionAgendaRepo.proximos()).toHaveLength(0);
    await ClinicasRepo.responder(ClinicasRepo.invitaciones[0], true);
    expect(RecepcionAgendaRepo.proximos().map((t) => t.id)).toEqual(["t-vera"]);
  });

  it("la fecha de un día que no es cercano no se repite", () => {
    const hoy = LocalDate.parse("2026-11-25");
    expect(Fechas.relativaConFecha(LocalDate.parse("2026-11-25"), hoy)).toBe("Hoy · 25 Nov 2026");
    expect(Fechas.relativaConFecha(LocalDate.parse("2026-11-27"), hoy)).toBe("27 Nov 2026");
  });

  it("al cerrar la sesión se olvida la agenda", async () => {
    vincular(VERA.id);
    await ingresarComo(LAURA);
    Sesion.olvidar();
    expect(RecepcionAgendaRepo.veterinarios).toHaveLength(0);
    expect(RecepcionAgendaRepo.proximos()).toHaveLength(0);
  });
});
