/*
 * Modo recepción: cuándo se ofrece al ingresar, qué agenda ve (solo la de sus veterinarios activos) y qué le manda
 * al servidor al sacar, mover y cancelar turnos y al marcar la llegada.
 */
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { RecepcionAgendaRepo } from "../../src/data/repositorio/recepcionAgendaRepo";
import { RecepcionRepo } from "../../src/data/repositorio/recepcionRepo";
import { Sesion } from "../../src/data/sesion";
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

function vincular(vet: string, estado: "activo" | "pendiente" = "activo") {
  fuente.recepcion.push({
    id: `rec-${fuente.recepcion.length + 1}`, veterinario_id: vet, recepcionista_id: LAURA.id, estado, iniciado_por: "veterinario",
  });
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

  it("con un pedido pendiente entra a la recepción, pero sin agenda hasta que el veterinario acepte", async () => {
    vincular(VERA.id, "pendiente");
    await ingresarComo(LAURA);
    expect(Sesion.rol).toBe("RECEPCIONISTA");
    expect(RecepcionAgendaRepo.veterinarios).toHaveLength(0);
    expect(RecepcionAgendaRepo.proximos()).toHaveLength(0);
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
    await RecepcionRepo.cargar();
    expect(Sesion.rolesDisponibles).toEqual(["DUENO", "RECEPCIONISTA"]);
    await Sesion.cambiarModo("RECEPCIONISTA");
    expect(RecepcionAgendaRepo.veterinarios.map((v) => v.nombre)).toEqual(["Dr. Vera"]);
  });

  it("al cerrar la sesión se olvida la agenda", async () => {
    vincular(VERA.id);
    await ingresarComo(LAURA);
    Sesion.olvidar();
    expect(RecepcionAgendaRepo.veterinarios).toHaveLength(0);
    expect(RecepcionAgendaRepo.proximos()).toHaveLength(0);
  });
});
