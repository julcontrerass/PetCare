/* Migrado de app/src/test/.../DuenoRepoTest.kt. */
import "../soporte/pruebaBase";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { Sesion } from "../../src/data/sesion";
import { SaludRepo } from "../../src/data/repositorio/saludRepo";
import { posologia, signosTexto } from "../../src/model/clinica";
import { Mascota } from "../../src/model/modelos";
import { LocalDate } from "../../src/util/tiempo";
import { asentar } from "../soporte/asentar";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";

let fuente: FuenteEnMemoria;
const manana = () => LocalDate.now().plusDays(1);
/** El próximo día de la semana (1 = lunes) estrictamente posterior a hoy: `TemporalAdjusters.next`. */
const proximo = (dia: number) => LocalDate.now().plusDays(((dia - LocalDate.now().dayOfWeek + 6) % 7) + 1);
/** El próximo día de la semana contando hoy: `TemporalAdjusters.nextOrSame`. */
const proximoOHoy = (desde: LocalDate, dia: number) => desde.plusDays((dia - desde.dayOfWeek + 7) % 7);
const iguales = (a: LocalDate | null | undefined, b: LocalDate) => expect(a?.equals(b)).toBe(true);

beforeEach(() => {
  fuente = prepararServicios();
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.mascotas.push(Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  fuente.perfiles.push(Escenario.veterinario());
});

afterEach(() => {
  limpiarServicios();
});

test("cargar_armaMascotasYTurnosSinLosCancelados", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", manana().toString(), "10:00:00"));
  fuente.turnosGuardados.push(Escenario.turno("t2", "m2", manana().toString(), "11:00:00", Escenario.VET_ID, "cancelado"));

  await ingresarComoDueno();

  expect(DuenoRepo.mascotas.map((m) => m.nombre)).toEqual(["Rex", "Mia"]);
  expect(DuenoRepo.eventos).toHaveLength(1);
  const turno = DuenoRepo.eventos[0];
  expect(turno.mascota).toBe("Rex");
  expect(turno.veterinario).toBe("Dr. Vera");
  expect(turno.hora).toBe("10:00");
});

test("veterinarios_seClasificanSegunSusAccesos", async () => {
  fuente.perfiles.push(Escenario.veterinario("vet-2", "Dra. Sosa"));
  fuente.perfiles.push(Escenario.veterinario("vet-3", "Dr. Pendiente"));
  fuente.perfiles.push(Escenario.veterinario("vet-4", "Dr. Suspendido", "suspendido"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
  fuente.accesosGuardados.push({ ...accesoDto("a2", "m1", "vet-3", "pendiente", "veterinario"), created_at: "2026-01-01T10:00:00+00:00" });
  fuente.accesosGuardados.push(accesoDto("a3", "m1", "vet-4", "activo", "dueno"));

  await ingresarComoDueno();

  expect(DuenoRepo.autorizados.map((v) => v.nombre)).toEqual(["Dr. Vera"]);
  expect(DuenoRepo.autorizados[0].estado).toBe("ACTIVO");
  expect([...DuenoRepo.autorizados[0].mascotas]).toEqual(["Rex"]);
  // Quien pidió acceso aparece como solicitud, no como veterinario disponible
  expect(DuenoRepo.disponibles.map((v) => v.nombre)).toEqual(["Dra. Sosa"]);
  expect(DuenoRepo.solicitudes).toHaveLength(1);
  expect(DuenoRepo.solicitudes[0].solicitante).toBe("Dr. Pendiente");
  expect(DuenoRepo.solicitudes[0].mascota).toContain("Rex");
});

test("agregarMascota_seVeEnseguidaYSeMandaAlServidor", async () => {
  await ingresarComoDueno();

  DuenoRepo.agregarMascota(new Mascota("Luna", "Gato", { raza: "Siamés" }));
  await asentar();

  expect(DuenoRepo.buscarMascota("Luna")).not.toBeNull();
  expect(fuente.llamadas).toContain("crearMascota:Luna");
  expect(fuente.mascotas.some((m) => m.nombre === "Luna" && m.dueno_id === Escenario.DUENO_ID)).toBe(true);
});

test("darDeBajaMascota_laSacaDeLaListaYBorraSusTurnos", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", manana().toString(), "10:00:00"));
  await ingresarComoDueno();

  DuenoRepo.darDeBajaMascota(DuenoRepo.buscarMascota("Rex")!);
  await asentar();

  expect(DuenoRepo.buscarMascota("Rex")).toBeNull();
  expect(DuenoRepo.eventos).toHaveLength(0);
  expect(fuente.mascotas.find((m) => m.id === "m1")!.activa).toBe(false);
});

test("agendarEvento_creaElTurnoYElVeterinarioPasaATenerAcceso", async () => {
  await ingresarComoDueno();
  expect(DuenoRepo.todosLosVeterinarios()[0].estado).toBe("DISPONIBLE");

  DuenoRepo.agendarEvento(manana(), "Control", "Rex", "Dr. Vera", "10:00", "Traer carnet");
  await asentar();

  expect(DuenoRepo.eventos).toHaveLength(1);
  expect(fuente.turnosGuardados).toHaveLength(1);
  expect(fuente.turnosGuardados[0].hora).toBe("10:00:00");
  expect(fuente.turnosGuardados[0].veterinario_id).toBe(Escenario.VET_ID);
  expect(fuente.turnosGuardados[0].notas).toBe("Traer carnet");
  expect(DuenoRepo.autorizados.map((v) => v.nombre)).toEqual(["Dr. Vera"]);
  expect(DuenoRepo.disponibles).toHaveLength(0);
});

test("hayConflictoDeTurno_soloParaLaMismaMascotaYHora", async () => {
  await ingresarComoDueno();
  DuenoRepo.agendarEvento(manana(), "Control", "Rex", "Dr. Vera", "10:00", "");

  expect(DuenoRepo.hayConflictoDeTurno(manana(), "10:00", "Rex")).toBe(true);
  expect(DuenoRepo.hayConflictoDeTurno(manana(), "11:00", "Rex")).toBe(false);
  expect(DuenoRepo.hayConflictoDeTurno(manana(), "10:00", "Mia")).toBe(false);
  await asentar();
});

test("cancelarEvento_loSacaDeLaListaYLoCancelaEnElServidor", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", manana().toString(), "10:00:00"));
  await ingresarComoDueno();

  DuenoRepo.cancelarEvento(DuenoRepo.eventos[0]);
  await asentar();

  expect(DuenoRepo.eventos).toHaveLength(0);
  expect(fuente.turnosGuardados[0].estado).toBe("cancelado");
});

test("modificarEvento_cambiaFechaHoraYVeterinario", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", manana().toString(), "10:00:00", null));
  await ingresarComoDueno();
  const pasado = manana().plusDays(2);

  DuenoRepo.modificarEvento(DuenoRepo.eventos[0], pasado, "11:30", "Dr. Vera", "Cambio");
  await asentar();

  const evento = DuenoRepo.eventos[0];
  iguales(evento.fecha, pasado);
  expect(evento.hora).toBe("11:30");
  expect(evento.veterinarioId).toBe(Escenario.VET_ID);
  expect(fuente.llamadas.some((l) => l.startsWith("turno:t1:") && l.includes("hora=11:30:00"))).toBe(true);
});

test("revocarYRestablecerAcceso_actualizanTodosLosAccesosDelVeterinario", async () => {
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
  fuente.accesosGuardados.push(accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"));
  await ingresarComoDueno();
  const vet = DuenoRepo.autorizados[0];

  DuenoRepo.revocarAcceso(vet);
  await asentar();
  expect(DuenoRepo.autorizados[0].estado).toBe("INACTIVO");
  expect(fuente.accesosGuardados.every((a) => a.estado === "inactivo")).toBe(true);

  DuenoRepo.restablecerAcceso(DuenoRepo.autorizados[0]);
  await asentar();
  expect(DuenoRepo.autorizados[0].estado).toBe("ACTIVO");
  expect(fuente.accesosGuardados.every((a) => a.estado === "activo")).toBe(true);
});

test("autorizarVeterinario_comparteTodasLasMascotas", async () => {
  await ingresarComoDueno();
  const candidatos = DuenoRepo.candidatosAAutorizar("vera");
  expect(candidatos).toHaveLength(1);

  DuenoRepo.autorizarVeterinario(candidatos[0]);
  await asentar();

  expect(fuente.accesosGuardados.filter((a) => a.veterinario_id === Escenario.VET_ID && a.estado === "activo")).toHaveLength(2);
  expect(DuenoRepo.autorizados.map((v) => v.nombre)).toEqual(["Dr. Vera"]);
  expect(DuenoRepo.candidatosAAutorizar("")).toHaveLength(0);
});

test("resolverSolicitud_aceptaORechazaEnElServidor", async () => {
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "pendiente", "veterinario"));
  fuente.accesosGuardados.push(accesoDto("a2", "m2", Escenario.VET_ID, "pendiente", "veterinario"));
  await ingresarComoDueno();
  expect(DuenoRepo.solicitudes).toHaveLength(2);

  const [primera, segunda] = [...DuenoRepo.solicitudes];
  DuenoRepo.resolverSolicitud(primera, true);
  DuenoRepo.resolverSolicitud(segunda, false);
  await asentar();

  expect(fuente.accesosGuardados.find((a) => a.id === "a1")!.estado).toBe("activo");
  expect(fuente.accesosGuardados.find((a) => a.id === "a2")!.estado).toBe("rechazado");
});

test("notificaciones_seMarcanComoLeidasYSeBorran", async () => {
  fuente.notificacionesGuardadas.push({ id: "n1", tipo: "turno", titulo: "Turno nuevo", mensaje: "Mañana 10:00", leida: false, created_at: "2026-01-01T10:00:00+00:00" });
  await ingresarComoDueno();
  expect(DuenoRepo.hayNotificacionesSinLeer).toBe(true);

  DuenoRepo.marcarNotificacionesLeidas();
  await asentar();
  expect(DuenoRepo.hayNotificacionesSinLeer).toBe(false);
  expect(fuente.llamadas).toContain("notificacionesLeidas");

  DuenoRepo.limpiarNotificaciones();
  await asentar();
  expect(DuenoRepo.notificaciones).toHaveLength(0);
});

test("notificaciones_elTurnoFinalizadoTieneSuPropioTipo", async () => {
  fuente.notificacionesGuardadas.push({ id: "n1", tipo: "completado", titulo: "Turno finalizado", mensaje: "Rex: el turno fue completado", leida: false, created_at: "2026-01-01T10:00:00+00:00" });
  fuente.notificacionesGuardadas.push({ id: "n2", tipo: "turno", titulo: "Nuevo turno", mensaje: "Rex", leida: false, created_at: "2026-01-01T09:00:00+00:00" });
  await ingresarComoDueno();

  expect(DuenoRepo.notificaciones.map((n) => n.tipo)).toEqual(["COMPLETADO", "TURNO"]);
});

test("guardarPerfil_actualizaLaCopiaYElServidor", async () => {
  await ingresarComoDueno();

  DuenoRepo.guardarPerfil("Ana María Prueba", "1166667777", "Otra calle 5");
  await asentar();

  expect(DuenoRepo.perfil.nombre).toBe("Ana María Prueba");
  expect(DuenoRepo.perfil.primerNombre).toBe("Ana");
  expect(fuente.llamadas).toContain("perfil:direccion,nombre,telefono");
});

test("guardarMascota_actualizaElNombreEnSusTurnos", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", manana().toString(), "10:00:00"));
  await ingresarComoDueno();
  const rex = DuenoRepo.buscarMascota("Rex")!;

  rex.nombre = "Rexy";
  DuenoRepo.guardarMascota(rex);
  await asentar();

  expect(DuenoRepo.eventos[0].mascota).toBe("Rexy");
  expect(fuente.llamadas.some((l) => l.startsWith("mascota:m1:"))).toBe(true);
});

test("horasDe_ofreceTurnosCadaMediaHoraSoloLosDiasDeAtencion", async () => {
  await ingresarComoDueno();
  const vet = DuenoRepo.todosLosVeterinarios()[0];
  const lunes = proximo(1);
  const domingo = lunes.plusDays(6);

  expect(DuenoRepo.horasDe(vet, lunes)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  expect(DuenoRepo.horasDe(vet, domingo)).toHaveLength(0);
  expect(DuenoRepo.trabajaEl(vet, domingo)).toBe(false);
});

test("horasOcupadas_vienenDelServidor", async () => {
  await ingresarComoDueno();
  fuente.ocupados = [{ hora: "09:30", duracion_min: 30 }, { hora: "10:00", duracion_min: 30 }];

  const ocupadas = await DuenoRepo.horasOcupadas(DuenoRepo.todosLosVeterinarios()[0], manana());

  expect(ocupadas.map((o) => o.hora)).toEqual(["09:30", "10:00"]);
});

test("solicitudes_muestranParaQueTurnoPideAccesoElVeterinario", async () => {
  fuente.perfiles.push(Escenario.veterinario("vet-3", "Dr. Pendiente"));
  fuente.accesosGuardados.push({
    ...accesoDto("a2", "m1", "vet-3", "pendiente", "veterinario"),
    created_at: "2026-01-01T10:00:00+00:00",
    turno_propuesto: { categoria: "Control", fecha: "2026-12-15", hora: "10:00:00" },
  });

  await ingresarComoDueno();

  expect(DuenoRepo.solicitudes).toHaveLength(1);
  const texto = DuenoRepo.solicitudes[0].mascota;
  expect(texto).toContain("Rex");
  expect(texto).toContain("para un turno de Control");
  expect(texto).toContain("a las 10:00 hs");
});

test("peso_loQueGuardaElVeterinarioLlegaALaMascotaDelDueno", async () => {
  await ingresarComoDueno();
  expect(DuenoRepo.mascotas.find((m) => m.id === "m1")!.peso).toBe("12 kg");

  const i = fuente.mascotas.findIndex((m) => m.id === "m1");
  fuente.mascotas[i] = { ...fuente.mascotas[i], peso_kg: 13.5, alertas_clinicas: "Alérgico a la penicilina" };
  await DuenoRepo.recargarDerivados();

  const rex = DuenoRepo.mascotas.find((m) => m.id === "m1")!;
  expect(rex.peso).toBe("13.5 kg");
  expect(rex.alertas).toBe("Alérgico a la penicilina");
});

test("horasDe_noOfreceLosHorariosEnLosQueElTurnoNoTerminaAntesDelCierre", async () => {
  await ingresarComoDueno();
  const vet = DuenoRepo.todosLosVeterinarios()[0];
  const lunes = proximoOHoy(manana(), 1);

  // El veterinario atiende de 09:00 a 12:00: una cirugía de 2 horas solo puede arrancar hasta las 10:00
  expect(DuenoRepo.horasDe(vet, lunes, 120)).toEqual(["09:00", "09:30", "10:00"]);
  expect(DuenoRepo.horasDe(vet, lunes, 240)).toHaveLength(0);
});

test("estaOcupado_cuentaLaDuracionDeCadaTurno", () => {
  const ocupados = [{ hora: "10:00", duracion_min: 120 }];

  expect(DuenoRepo.estaOcupado("11:30", 30, ocupados)).toBe(true);
  expect(DuenoRepo.estaOcupado("12:00", 30, ocupados)).toBe(false);
  expect(DuenoRepo.estaOcupado("09:00", 60, ocupados)).toBe(false);
  expect(DuenoRepo.estaOcupado("09:00", 90, ocupados)).toBe(true);
});

test("horaFin_sumaLaDuracion", () => {
  expect(DuenoRepo.horaFin("10:00", 90)).toBe("11:30");
  expect(DuenoRepo.horaFin("10:00", 120)).toBe("12:00");
});

test("duracionDe_usaLoQueConfiguroElVeterinarioYSinoLaHabitual", async () => {
  fuente.perfiles.push(
    Escenario.perfil("vet-9", "veterinario", "Dr. Cirujano", {
      veterinario: { matricula: "MP-9", especialidades: ["Cirugía 24hs", "Cardiología"], duraciones: { "Cirugía 24hs": 180 } },
    }),
  );
  await ingresarComoDueno();

  const vet = DuenoRepo.buscarVeterinario("Dr. Cirujano")!;

  expect(vet.duracionDe("Cirugía 24hs")).toBe(180);
  expect(vet.duracionDe("Cardiología")).toBe(45);
  expect(vet.duracionDe("Algo que no está en el catálogo")).toBe(30);
});

test("veterinariosPara_noOfreceAlQueNoAtiendeEseTipoDeAnimal", async () => {
  fuente.perfiles.push(
    Escenario.perfil("vet-9", "veterinario", "Dra. Solo Perros", {
      veterinario: { matricula: "MP-9", especialidades: ["Chequeo médico integral"], tipos_animales: ["Perro"] },
    }),
  );
  await ingresarComoDueno();

  const perro = DuenoRepo.veterinariosPara("Chequeo médico integral", "Perro").map((v) => v.nombre).sort();
  const gato = DuenoRepo.veterinariosPara("Chequeo médico integral", "Gato").map((v) => v.nombre);
  const conejo = DuenoRepo.veterinariosPara("Chequeo médico integral", "Conejo").map((v) => v.nombre);

  expect(perro).toEqual(["Dr. Vera", "Dra. Solo Perros"]);
  expect(gato).toEqual(["Dr. Vera"]);
  // Lo que no tiene nombre propio cuenta como "Otro": Dr. Vera atiende todos, la otra solo perros
  expect(conejo).toEqual(["Dr. Vera"]);
});

test("turno_traeLaDuracionQueFijoElServidorYSeSuperponeConLoQueCubre", async () => {
  fuente.turnosGuardados.push({ ...Escenario.turno("t1", "m1", manana().toString(), "10:00:00"), duracion_min: 120 });
  await ingresarComoDueno();

  expect(DuenoRepo.eventos[0].duracionMin).toBe(120);
  expect(DuenoRepo.hayConflictoDeTurno(manana(), "11:30", "Rex", null, 30)).toBe(true);
  expect(DuenoRepo.hayConflictoDeTurno(manana(), "12:00", "Rex", null, 30)).toBe(false);
  expect(DuenoRepo.hayConflictoDeTurno(manana(), "11:30", "Mia", null, 30)).toBe(false);
});

test("carnetDelDueno_losTratamientosDeLosInformesSeVenEnTratamientos", async () => {
  fuente.informes.push({
    id: "i1", mascota_id: "m1", turno_id: "t1", veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Otitis",
    tratamiento: "Gotas cada 8 hs", created_at: new Date().toISOString(),
  });
  fuente.informes.push({ id: "i2", mascota_id: "m1", turno_id: "t2", veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Sano", tratamiento: null });
  await ingresarComoDueno();

  await SaludRepo.cargarComoDueno();

  const tratamientos = SaludRepo.filtrar("TRATAMIENTO", "", null);
  expect(tratamientos.map((t) => t.titulo)).toEqual(["Otitis"]);
  expect(tratamientos[0].detalle).toBe("Gotas cada 8 hs");
  expect(tratamientos[0].mascota).toBe("Rex");
  expect(tratamientos[0].deConsulta).toBe(true);
});

test("veterinariosPara_prefiereLosQueTienenLaEspecialidad", async () => {
  fuente.perfiles.push(
    Escenario.perfil("vet-9", "veterinario", "Dr. Cirujano", {
      veterinario: { matricula: "MP-9", especialidades: ["Cirugía 24hs"] },
    }),
  );
  // Cardiología pide título: sin aprobar, el Dr. Vera no la ofrece (sus servicios generales, sí)
  await ingresarComoDueno();
  expect(DuenoRepo.veterinariosPara("Cardiología")).toHaveLength(0);
  expect(DuenoRepo.veterinariosPara("chequeo médico integral").map((v) => v.nombre)).toEqual(["Dr. Vera"]);

  Sesion.olvidar();
  fuente.aprobarEspecialidades(fuente.perfiles.find((p) => p.nombre === "Dr. Vera")!);
  await ingresarComoDueno();
  expect(DuenoRepo.veterinariosPara("Cirugía 24hs").map((v) => v.nombre)).toEqual(["Dr. Cirujano"]);
  expect(DuenoRepo.veterinariosPara("Cardiología").map((v) => v.nombre)).toEqual(["Dr. Vera"]);
  expect(DuenoRepo.veterinariosPara("chequeo médico integral").map((v) => v.nombre)).toEqual(["Dr. Vera"]);
  // Si nadie ofrece lo que se eligió no se muestra a cualquiera
  expect(DuenoRepo.veterinariosPara("Oncología")).toHaveLength(0);
  // Sin elegir nada se ofrecen todos
  expect(DuenoRepo.veterinariosPara(null)).toHaveLength(2);
});

test("informeDelTurno_elDuenoLeeDiagnosticoYTratamiento", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", LocalDate.now().toString(), "10:00:00", Escenario.VET_ID, "completado"));
  fuente.informes.push({ id: "i1", mascota_id: "m1", turno_id: "t1", veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Otitis", tratamiento: "Gotas" });
  await ingresarComoDueno();

  const detalle = await DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0]);

  expect(detalle.diagnostico).toBe("Otitis");
  expect(detalle.tratamiento).toBe("Gotas");
  expect(detalle.motivo).toBe("Control");
  expect(DuenoRepo.eventos[0].estado).toBe("COMPLETADO");
});

test("informeDelTurno_traeSignosVitalesYLaRecetaDeLaConsulta", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", LocalDate.now().toString(), "10:00:00", Escenario.VET_ID, "completado"));
  fuente.informes.push({
    id: "i1", mascota_id: "m1", turno_id: "t1", veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Otitis",
    tratamiento: "Gotas", anamnesis: "Se rasca", examen_fisico: "Oído rojo", peso_kg: 12.0, temperatura_c: 38.4,
  });
  fuente.recetas.push({
    id: "p1", mascota_id: "m1", turno_id: "t1", veterinario_id: Escenario.VET_ID, medicamento: "Gotas óticas", dosis: "3 gotas",
    frecuencia_horas: 12, duracion_dias: 5, indicaciones: null, inicio: LocalDate.now().toString(),
  });
  fuente.recetas.push({
    id: "p2", mascota_id: "m1", turno_id: "otro-turno", veterinario_id: Escenario.VET_ID, medicamento: "Otra cosa", dosis: null,
    frecuencia_horas: null, duracion_dias: null, indicaciones: null, inicio: LocalDate.now().toString(),
  });
  await ingresarComoDueno();

  const detalle = await DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0]);

  expect(detalle.anamnesis).toBe("Se rasca");
  expect(detalle.examenFisico).toBe("Oído rojo");
  expect(signosTexto(detalle.signos)).toBe("Peso 12 kg · Temp. 38.4 °C");
  expect(detalle.receta.map((r) => r.medicamento)).toEqual(["Gotas óticas"]);
  expect(posologia(detalle.receta[0])).toBe("3 gotas, cada 12 hs, durante 5 días");
  expect(detalle.vacio).toBe(false);
});

test("informeDelTurno_sinInformeDevuelveNull", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", LocalDate.now().toString(), "10:00:00"));
  await ingresarComoDueno();

  expect((await DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0])).vacio).toBe(true);
});

test("detalleDelTurno_incluyeLosRegistrosYArchivosQueCargoElVeterinarioEseDia", async () => {
  const hoy = LocalDate.now();
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00", Escenario.VET_ID, "completado"));
  fuente.registros.push({ id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", detalle: null, fecha: hoy.toString(), creado_por: Escenario.VET_ID });
  fuente.registros.push({ id: "r2", mascota_id: "m1", tipo: "vacuna", titulo: "De otro día", detalle: null, fecha: hoy.minusDays(40).toString(), creado_por: Escenario.VET_ID });
  const ahora = new Date().toISOString();
  fuente.archivos.push({ id: "a1", mascota_id: "m1", nombre: "Radiografía", extension: "pdf", storage_path: "m1/a1.pdf", subido_por: Escenario.VET_ID, turno_id: "t1", created_at: ahora });
  // Subido el mismo día por el mismo veterinario, pero suelto en la ficha: no es de este turno
  fuente.archivos.push({ id: "a2", mascota_id: "m1", nombre: "Suelto", extension: "pdf", storage_path: "m1/a2.pdf", subido_por: Escenario.VET_ID, created_at: ahora });
  // Adjunto a otro turno
  fuente.archivos.push({ id: "a3", mascota_id: "m1", nombre: "De otro turno", extension: "pdf", storage_path: "m1/a3.pdf", subido_por: Escenario.VET_ID, turno_id: "t9", created_at: ahora });
  await ingresarComoDueno();

  const detalle = await DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0]);

  expect(detalle.registros).toEqual(["Vacuna: Rabia"]);
  expect(detalle.archivos.map((a) => a.nombre)).toEqual(["Radiografía.pdf"]);
  expect(detalle.vacio).toBe(false);
});

test("turnoCompletado_dejaDeSerProximoAunqueSeaDeHoy", async () => {
  const hoy = LocalDate.now();
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", hoy.toString(), "23:00:00", Escenario.VET_ID, "completado"));
  fuente.turnosGuardados.push(Escenario.turno("t2", "m1", hoy.toString(), "23:30:00"));
  await ingresarComoDueno();

  expect(DuenoRepo.eventosOrdenados(true).map((e) => e.id)).toEqual(["t2"]);
  expect(DuenoRepo.eventosOrdenados(false).map((e) => e.id)).toEqual(["t1"]);
  expect(DuenoRepo.proximoEvento("Rex")!.hora).toBe("23:30");
});

test("cambiosEnVivo_unTurnoNuevoDelServidorApareceSinTocarNada", async () => {
  await ingresarComoDueno();
  expect(DuenoRepo.eventos).toHaveLength(0);

  // Otro dispositivo (o el veterinario) agenda un turno y el servidor avisa
  fuente.turnosGuardados.push(Escenario.turno("t9", "m1", LocalDate.now().plusDays(2).toString(), "10:00:00"));
  fuente.avisosDelServidor.tryEmit();
  // La recarga espera 300 ms para juntar cambios seguidos
  await new Promise((r) => setTimeout(r, 700));
  await asentar();

  expect(DuenoRepo.eventos).toHaveLength(1);
  expect(DuenoRepo.eventos[0].id).toBe("t9");
});

test("carnetDelDueno_cargaSusRegistrosYLosArchivosDeLasConsultas", async () => {
  const hoy = LocalDate.now();
  fuente.registros.push({ id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", detalle: null, fecha: hoy.toString(), proxima_dosis: hoy.plusDays(300).toString() });
  fuente.archivos.push({
    id: "a1", mascota_id: "m1", nombre: "Radiografía", extension: "pdf", storage_path: "m1/a1.pdf", subido_por: Escenario.VET_ID,
    turno_id: "t1", created_at: new Date().toISOString(),
  });
  await ingresarComoDueno();

  await SaludRepo.cargarComoDueno();

  const vacunas = SaludRepo.filtrar("VACUNA", "", null);
  const documentos = SaludRepo.filtrar("DOCUMENTO", "", null);
  expect(vacunas.map((v) => v.titulo)).toEqual(["Rabia"]);
  expect(vacunas[0].mascota).toBe("Rex");
  expect(documentos.map((d) => d.titulo)).toEqual(["Radiografía"]);
  expect(documentos[0].archivoPath).toBe("m1/a1.pdf");
});

test("estudiosPrevios_seEligenOSeSubenYSeAdjuntanAlTurno", async () => {
  fuente.registros.push({
    id: "r1", mascota_id: "m1", tipo: "documento", titulo: "Análisis de sangre", detalle: null,
    fecha: LocalDate.now().minusDays(30).toString(), archivo_path: "m1/analisis.pdf",
  });
  fuente.archivos.push({ id: "a1", mascota_id: "m1", nombre: "Ecografía", extension: "jpg", storage_path: "m1/eco.jpg", subido_por: Escenario.VET_ID });
  await ingresarComoDueno();
  const rex = DuenoRepo.buscarMascota("Rex")!;

  const disponibles = await DuenoRepo.estudiosDisponibles(rex);
  expect(new Set(disponibles.map((d) => d.nombre))).toEqual(new Set(["Análisis de sangre", "Ecografía"]));

  const nuevo = await DuenoRepo.subirEstudio(rex, "Radiografía", "torax.pdf", "pdf", new Uint8Array(8), "application/pdf");
  expect(fuente.subidas.some((s) => s.startsWith("archivos/m1/"))).toBe(true);

  DuenoRepo.agendarEvento(LocalDate.now().plusDays(3), "Control", "Rex", "Dr. Vera", "10:00", "", [disponibles[0], nuevo]);
  await asentar();

  expect(fuente.turnosGuardados).toHaveLength(1);
  const turnoId = fuente.turnosGuardados[0].id;
  expect(fuente.estudios.filter((e) => e.turno_id === turnoId)).toHaveLength(2);
  expect(fuente.llamadas).toContain("adjuntarEstudios:2");

  // El dueño los ve en el detalle del turno
  expect(DuenoRepo.eventos).toHaveLength(1);
  const detalle = await DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0]);
  expect(detalle.estudios).toHaveLength(2);
  expect(detalle.estudios.find((e) => e.nombre.startsWith("Radiografía"))!.tipo).toBe("Radiografía");
  expect(nuevo.nombre).toBe("Radiografía - torax");
});

test("agendarConUnServicio_loGuardaComoCategoriaDelTurno", async () => {
  await ingresarComoDueno();

  DuenoRepo.agendarEvento(LocalDate.now().plusDays(2), "Cardiología", "Rex", "Dr. Vera", "10:00", "");
  await asentar();

  expect(fuente.turnosGuardados).toHaveLength(1);
  expect(fuente.turnosGuardados[0].categoria).toBe("Cardiología");
});

test("soloSePuedenEditarLosTurnosProximos", async () => {
  const hoy = LocalDate.now();
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", hoy.plusDays(2).toString(), "10:00:00"));
  fuente.turnosGuardados.push(Escenario.turno("t2", "m1", hoy.plusDays(1).toString(), "10:00:00", Escenario.VET_ID, "completado"));
  fuente.turnosGuardados.push(Escenario.turno("t3", "m2", hoy.minusDays(3).toString(), "10:00:00"));
  fuente.turnosGuardados.push(Escenario.turno("t4", "m2", hoy.plusDays(5).toString(), "11:00:00"));
  await ingresarComoDueno();

  expect(DuenoRepo.eventosEditables().map((e) => e.id)).toEqual(["t1", "t4"]);
  expect(DuenoRepo.eventosEditables("Rex").map((e) => e.id)).toEqual(["t1"]);
  expect(DuenoRepo.esEditable(DuenoRepo.eventos.find((e) => e.id === "t1")!)).toBe(true);
  expect(DuenoRepo.esEditable(DuenoRepo.eventos.find((e) => e.id === "t2")!)).toBe(false);
  expect(DuenoRepo.esEditable(DuenoRepo.eventos.find((e) => e.id === "t3")!)).toBe(false);
});

test("pesoValido_aceptaKilosConComaOUnidad", () => {
  expect(DuenoRepo.pesoValido("12")).toBe(true);
  expect(DuenoRepo.pesoValido("3,5 kg")).toBe(true);
  expect(DuenoRepo.pesoValido("mucho")).toBe(false);
  expect(DuenoRepo.pesoValido("0")).toBe(false);
});

test("tieneVacunaPendiente_soloSiHayUnaEnLosProximos30Dias", async () => {
  await ingresarComoDueno();
  DuenoRepo.agendarEvento(LocalDate.now().plusDays(10), "Vacuna", "Rex", "", "10:00", "");

  expect(DuenoRepo.tieneVacunaPendiente("Rex")).toBe(true);
  expect(DuenoRepo.tieneVacunaPendiente("Mia")).toBe(false);
  await asentar();
});

test("lugares_elDuenoVeLosLugaresYLosHorariosDeCadaUno", async () => {
  fuente.perfiles.push(Escenario.veterinarioEnDosLugares());
  await ingresarComoDueno();
  const vet = DuenoRepo.todosLosVeterinarios()[0];
  const lunes = proximo(1);
  const sabado = lunes.plusDays(5);
  const a = vet.sede("sede-a")!;
  const b = vet.sede("sede-b")!;

  expect(vet.sedes.map((s) => s.nombre)).toEqual(["Clínica Sur", "Consultorio Centro"]);
  expect(DuenoRepo.trabajaEl(vet, lunes, a)).toBe(true);
  expect(DuenoRepo.trabajaEl(vet, lunes, b)).toBe(false);
  expect(DuenoRepo.trabajaEl(vet, sabado, b)).toBe(true);
  expect(DuenoRepo.trabajaEnAlgunLugar(vet, sabado)).toBe(true);
  expect(DuenoRepo.horasDe(vet, lunes, 30, a)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  expect(DuenoRepo.horasDe(vet, sabado, 30, b)).toHaveLength(8);
  expect(DuenoRepo.horasDe(vet, sabado, 30, b)[0]).toBe("10:00");
});

test("lugares_elTurnoSeAgendaEnElLugarElegido", async () => {
  fuente.perfiles.push(Escenario.veterinarioEnDosLugares());
  await ingresarComoDueno();
  const sabado = proximo(6);

  DuenoRepo.agendarEvento(sabado, "Control", "Rex", "Dr. Vera", "10:00", "", [], "sede-b");
  await asentar();

  const evento = DuenoRepo.eventos.find((e) => e.fecha.equals(sabado))!;
  expect(evento.sedeId).toBe("sede-b");
  expect(DuenoRepo.sedeDe(evento)!.nombre).toBe("Consultorio Centro");
  expect(fuente.turnosGuardados.find((t) => t.id === evento.id)!.sede_id).toBe("sede-b");
});
