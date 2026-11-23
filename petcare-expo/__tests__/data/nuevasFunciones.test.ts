/* Migrado de app/src/test/.../NuevasFuncionesTest.kt (las partes de pantallas de NuevasPantallasTest.kt van en __tests__/ui). */
import "../soporte/pruebaBase";
import { Recordatorios } from "../../src/data/avisos/recordatorios";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { InformesRepo, informeEditable } from "../../src/data/repositorio/informesRepo";
import { RecordatoriosRepo } from "../../src/data/repositorio/recordatoriosRepo";
import { SaludRepo } from "../../src/data/repositorio/saludRepo";
import { LocalDate, LocalDateTime } from "../../src/util/tiempo";
import { asentar } from "../soporte/asentar";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";

// Estado de la mascota, permisos con vencimiento, informes cerrados, recordatorios hechos a mano y avisos borrables.

let fuente: FuenteEnMemoria;
const manana = () => LocalDate.now().plusDays(1);
const iso = (dias: number) => new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString();
const iguales = (a: LocalDate | LocalDateTime | null | undefined, b: LocalDate | LocalDateTime) => expect(a?.equals(b as never)).toBe(true);

beforeEach(() => {
  fuente = prepararServicios();
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.mascotas.push(Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  fuente.perfiles.push(Escenario.veterinario());
});

afterEach(() => {
  limpiarServicios();
});

// ---------- Estado de la mascota ----------

test("estadoMascota_inactivaCancelaLosTurnosPendientesYDejaDeAgendarse", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", manana().toString(), "10:00:00"));
  await ingresarComoDueno();
  const rex = DuenoRepo.buscarMascota("Rex")!;

  DuenoRepo.cambiarEstadoMascota(rex, "INACTIVA");
  await asentar();

  expect(rex.estado).toBe("INACTIVA");
  expect(DuenoRepo.mascotasActivas.map((m) => m.nombre)).toEqual(["Mia"]);
  expect(DuenoRepo.eventos).toHaveLength(0);
  expect(fuente.turnosGuardados.find((t) => t.id === "t1")!.estado).toBe("cancelado");
  expect(fuente.mascotas.find((m) => m.id === "m1")!.estado).toBe("inactiva");
  // La mascota sigue en la cuenta: se conserva su historial
  expect(DuenoRepo.buscarMascota("Rex")).not.toBeNull();
});

test("estadoMascota_fallecidaYVolverAActivar", async () => {
  await ingresarComoDueno();
  const mia = DuenoRepo.buscarMascota("Mia")!;

  DuenoRepo.cambiarEstadoMascota(mia, "FALLECIDA");
  await asentar();
  expect(fuente.mascotas.find((m) => m.id === "m2")!.estado).toBe("fallecida");
  expect(DuenoRepo.mascotasActivas).toHaveLength(1);

  DuenoRepo.cambiarEstadoMascota(mia, "ACTIVA");
  await asentar();
  expect(DuenoRepo.mascotasActivas).toHaveLength(2);
});

test("estadoMascota_seLeeDelServidorAlCargar", async () => {
  fuente.mascotas[0] = { ...fuente.mascotas[0], estado: "fallecida" };
  await ingresarComoDueno();

  expect(DuenoRepo.buscarMascota("Rex")!.estado).toBe("FALLECIDA");
  expect(DuenoRepo.mascotasActivas.map((m) => m.nombre)).toEqual(["Mia"]);
});

test("baja_guardaElMotivoElegido", async () => {
  await ingresarComoDueno();

  DuenoRepo.darDeBajaMascota(DuenoRepo.buscarMascota("Rex")!, "Adopción / Transferencia");
  await asentar();

  const guardada = fuente.mascotas.find((m) => m.id === "m1")!;
  expect(guardada.activa).toBe(false);
  expect(guardada.motivo_baja).toBe("Adopción / Transferencia");
});

test("salud_laListaDeDosisARecordarIncluyeLasDesparasitaciones", async () => {
  const hoy = LocalDate.now();
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
  fuente.registros.push({ id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", detalle: null, fecha: hoy.minusDays(5).toString(), proxima_dosis: hoy.minusDays(1).toString() });
  fuente.registros.push({ id: "r2", mascota_id: "m1", tipo: "desparasitacion", titulo: "Desparasitación interna", detalle: null, fecha: hoy.minusDays(80).toString(), proxima_dosis: hoy.plusDays(3).toString() });
  fuente.registros.push({ id: "r3", mascota_id: "m1", tipo: "desparasitacion", titulo: "Desparasitación externa", detalle: null, fecha: hoy.toString(), proxima_dosis: hoy.plusDays(90).toString() });
  await ingresarComoVeterinario();

  expect(SaludRepo.vacunasARecordar().map((r) => r.titulo)).toEqual(["Rabia", "Desparasitación interna"]);
});

// ---------- Permisos con vencimiento ----------

test("permisos_unoVencidoYaNoDaAcceso", async () => {
  const ayer = LocalDate.now().minusDays(1).toString();
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", ayer));

  await ingresarComoDueno();

  expect(DuenoRepo.autorizados).toHaveLength(1);
  const vet = DuenoRepo.autorizados[0];
  expect(vet.estado).toBe("INACTIVO");
  expect(vet.vencido).toBe(true);
  iguales(vet.venceEl, LocalDate.now().minusDays(1));
  expect(vet.mascotas.size).toBe(0);
});

test("permisos_conVencimientoFuturoSigueActivoYMuestraLaFecha", async () => {
  const dentroDeUnMes = LocalDate.now().plusMonths(1);
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", dentroDeUnMes.toString()));

  await ingresarComoDueno();

  expect(DuenoRepo.autorizados).toHaveLength(1);
  const vet = DuenoRepo.autorizados[0];
  expect(vet.estado).toBe("ACTIVO");
  expect(vet.vencido).toBe(false);
  iguales(vet.venceEl, dentroDeUnMes);
});

test("permisos_autorizarConVencimientoLoMandaAlServidor", async () => {
  await ingresarComoDueno();
  const hasta = LocalDate.now().plusMonths(3);

  DuenoRepo.autorizarVeterinario(DuenoRepo.disponibles[0], hasta);
  await asentar();

  expect(fuente.llamadas.some((l) => l.endsWith(`:${hasta.toString()}`) && l.startsWith("compartir:"))).toBe(true);
  expect(fuente.accesosGuardados.every((a) => a.vence_el === hasta.toString())).toBe(true);
});

test("permisos_cambiarYQuitarElVencimiento", async () => {
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
  await ingresarComoDueno();
  const vet = DuenoRepo.autorizados[0];
  const hasta = LocalDate.now().plusMonths(6);

  DuenoRepo.cambiarVencimiento(vet, hasta);
  await asentar();
  expect(fuente.accesosGuardados).toHaveLength(1);
  expect(fuente.accesosGuardados[0].vence_el).toBe(hasta.toString());

  DuenoRepo.cambiarVencimiento(vet, null);
  await asentar();
  expect(fuente.accesosGuardados[0].vence_el ?? null).toBeNull();
  expect(vet.venceEl).toBeNull();
});

test("permisos_restablecerUnVencidoLoVuelveAActivar", async () => {
  const ayer = LocalDate.now().minusDays(1).toString();
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", ayer));
  await ingresarComoDueno();
  const vet = DuenoRepo.autorizados[0];

  DuenoRepo.restablecerAcceso(vet, null);
  await asentar();

  expect(vet.estado).toBe("ACTIVO");
  expect(vet.vencido).toBe(false);
  expect(fuente.accesosGuardados[0].vence_el ?? null).toBeNull();
});

// ---------- Informe cerrado ----------

test("informe_deHoyEsEditablePeroElDeOtroDiaQuedaCerrado", async () => {
  fuente.informes.push({ id: "i-viejo", mascota_id: "m1", turno_id: null, veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Sano", tratamiento: "Nada", created_at: iso(-3) });
  fuente.informes.push({ id: "i-hoy", mascota_id: "m2", turno_id: null, veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Sano", tratamiento: "Nada", created_at: new Date().toISOString() });
  await ingresarComoVeterinario();

  const viejo = await InformesRepo.cargar("m1", null);
  const deHoy = await InformesRepo.cargar("m2", null);

  expect(informeEditable(viejo)).toBe(false);
  expect(informeEditable(deHoy)).toBe(true);
});

test("informe_cerradoNoSeModifica", async () => {
  fuente.informes.push({ id: "i-viejo", mascota_id: "m1", turno_id: null, veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Sano", tratamiento: "Nada", created_at: iso(-3) });
  await ingresarComoVeterinario();
  await InformesRepo.cargar("m1", null);

  InformesRepo.guardar("m1", "Otro motivo", "Otro diagnóstico", "Otro tratamiento", null);
  await asentar();

  expect(InformesRepo.obtener("m1").motivo).toBe("Control");
  expect(fuente.ultimosCambiosDeInforme).toBeNull();
});

// ---------- Notificaciones ----------

test("notificaciones_unaSolaSeBorraSinTocarLasDemas", async () => {
  const ahora = new Date().toISOString();
  fuente.notificacionesGuardadas.push({ id: "n1", tipo: "turno", titulo: "Uno", mensaje: "Primero", leida: false, created_at: ahora });
  fuente.notificacionesGuardadas.push({ id: "n2", tipo: "turno", titulo: "Dos", mensaje: "Segundo", leida: false, created_at: ahora });
  await ingresarComoDueno();
  const primera = DuenoRepo.notificaciones.find((n) => n.id === "n1")!;

  DuenoRepo.borrarNotificacion(primera);
  await asentar();

  expect(DuenoRepo.notificaciones.map((n) => n.id)).toEqual(["n2"]);
  expect(fuente.notificacionesGuardadas.map((n) => n.id)).toEqual(["n2"]);
  expect(fuente.llamadas).toContain("notificacionBorrada:n1");
});

// ---------- Recordatorios hechos a mano ----------

test("recordatorios_elDuenoCreaEditaYBorra", async () => {
  await ingresarComoDueno();
  const dia = LocalDate.now().plusDays(5);

  const creado = RecordatoriosRepo.crear("m1", "Bañar a Rex", "Higiene", dia, "10:30", "Con shampoo suave");
  await asentar();
  expect(fuente.recordatoriosGuardados).toHaveLength(1);
  expect(fuente.recordatoriosGuardados[0].hora).toBe("10:30:00");
  expect(fuente.recordatoriosGuardados[0].tipo).toBe("higiene");
  expect(creado.esMio).toBe(true);

  RecordatoriosRepo.editar(creado, "Bañar y cepillar a Rex", "Higiene", dia.plusDays(1), null, "");
  await asentar();
  expect(fuente.recordatoriosGuardados[0].titulo).toBe("Bañar y cepillar a Rex");
  expect(fuente.recordatoriosGuardados[0].fecha).toBe(dia.plusDays(1).toString());

  RecordatoriosRepo.borrar(creado);
  await asentar();
  expect(fuente.recordatoriosGuardados).toHaveLength(0);
  expect(RecordatoriosRepo.lista).toHaveLength(0);
});

test("recordatorios_elDuenoVeLosDelVeterinarioPeroNoLosPuedeTocar", async () => {
  fuente.recordatoriosGuardados.push({
    id: "r1", mascota_id: "m1", creado_por: Escenario.VET_ID, titulo: "Control de peso", tipo: "control",
    fecha: LocalDate.now().plusDays(10).toString(),
  });
  await ingresarComoDueno();

  expect(RecordatoriosRepo.lista).toHaveLength(1);
  const delVeterinario = RecordatoriosRepo.lista[0];
  expect(delVeterinario.esMio).toBe(false);

  RecordatoriosRepo.borrar(delVeterinario);
  RecordatoriosRepo.editar(delVeterinario, "Otro", "Otro", LocalDate.now(), null, "");
  await asentar();

  expect(RecordatoriosRepo.lista).toHaveLength(1);
  expect(RecordatoriosRepo.lista[0].titulo).toBe("Control de peso");
  expect(fuente.recordatoriosGuardados).toHaveLength(1);
});

test("recordatorios_elVeterinarioLeDejaUnoAlPaciente", async () => {
  await ingresarComoVeterinario();
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));

  RecordatoriosRepo.crear("m1", "Repetir análisis", "Control", LocalDate.now().plusDays(7), null, "Ayuno de 8 horas");
  await asentar();

  expect(fuente.recordatoriosGuardados).toHaveLength(1);
  const guardado = fuente.recordatoriosGuardados[0];
  expect(guardado.creado_por).toBe(Escenario.VET_ID);
  expect(guardado.mascota_id).toBe("m1");
  expect(RecordatoriosRepo.deMascota("m1")).toHaveLength(1);
  expect(RecordatoriosRepo.deMascota("m1")[0].titulo).toBe("Repetir análisis");
});

test("recordatorios_avisanElDiaYLaHoraElegidos", () => {
  const ahora = LocalDateTime.of(2026, 5, 1, 8, 0);
  const avisos = Recordatorios.paraManuales(
    [
      new Recordatorios.Manual("a", "Rex", "Baño", LocalDate.of(2026, 5, 2), "10:30", "Con shampoo"),
      new Recordatorios.Manual("b", "Mia", "Vacuna", LocalDate.of(2026, 5, 3), null, ""),
      new Recordatorios.Manual("c", "Rex", "Pasado", LocalDate.of(2026, 4, 1), null, ""),
    ],
    ahora,
  );

  expect(avisos).toHaveLength(2);
  iguales(avisos[0].momento, LocalDateTime.of(2026, 5, 2, 10, 30));
  iguales(avisos[1].momento, LocalDateTime.of(2026, 5, 3, 9, 0));
  expect(avisos[0].titulo).toBe("Recordatorio: Baño");
  expect(avisos[0].mensaje).toBe("Rex · Con shampoo");
});
