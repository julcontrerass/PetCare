/* Migrado de app/src/test/.../VeterinarioRepoTest.kt. */
import "../soporte/pruebaBase";
import { ArchivosRepo } from "../../src/data/repositorio/archivosRepo";
import { AgendaRepo } from "../../src/data/repositorio/agendaRepo";
import { DisponibilidadVet } from "../../src/data/repositorio/disponibilidadVet";
import { InformesRepo } from "../../src/data/repositorio/informesRepo";
import { PacientesRepo } from "../../src/data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../src/data/repositorio/perfilVetRepo";
import { PrescripcionesRepo } from "../../src/data/repositorio/prescripcionesRepo";
import { SaludRepo } from "../../src/data/repositorio/saludRepo";
import { SolicitudesRepo } from "../../src/data/repositorio/solicitudesRepo";
import { Sesion } from "../../src/data/sesion";
import { posologia, signosTexto } from "../../src/model/clinica";
import { crearSede } from "../../src/model/modelos";
import { TiposMascota } from "../../src/model/tiposMascota";
import { LocalDate } from "../../src/util/tiempo";
import { asentar } from "../soporte/asentar";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import type { RegistroSaludDto } from "../../src/data/remoto/dtos";

let fuente: FuenteEnMemoria;
const hoy = LocalDate.now();
/** `TemporalAdjusters.next(MONDAY)`: el lunes siguiente (estrictamente posterior a hoy). */
const proximoLunes = () => LocalDate.now().plusDays(((1 - LocalDate.now().dayOfWeek + 6) % 7) + 1);

beforeEach(() => {
  fuente = prepararServicios();
  fuente.perfiles.push(Escenario.dueno());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.mascotas.push(Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  fuente.mascotas.push(Escenario.mascota("m3", "Sin acceso"));
  fuente.mascotas.push(Escenario.mascota("m4", "Loro", Escenario.DUENO_ID, "Ave"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
  fuente.accesosGuardados.push(accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"));
  fuente.accesosGuardados.push(accesoDto("a4", "m4", Escenario.VET_ID, "activo", "dueno"));
  fuente.accesosGuardados.push(accesoDto("a3", "m3", Escenario.VET_ID, "pendiente", "veterinario"));
});

afterEach(() => {
  limpiarServicios();
});

// ---------- Pacientes ----------

test("pacientes_soloLosQueTienenAccesoActivo", async () => {
  await ingresarComoVeterinario();

  expect(PacientesRepo.pacientes.map((p) => p.nombre)).toEqual(["Rex", "Mia", "Loro"]);
  expect(PacientesRepo.porId("m3")).toBeNull();
  expect(PacientesRepo.nombreDe("inexistente")).toBe("Mascota");
});

test("pacientes_filtraPorEspecieYBusqueda", async () => {
  await ingresarComoVeterinario();

  expect(PacientesRepo.filtrar("", PacientesRepo.ESPECIE_GATO).map((p) => p.nombre)).toEqual(["Mia"]);
  expect(PacientesRepo.filtrar("", "Ave").map((p) => p.nombre)).toEqual(["Loro"]);
  // "Otro" reúne a los animales que no tienen un tipo propio
  expect(PacientesRepo.filtrar("", PacientesRepo.ESPECIE_OTRO)).toHaveLength(0);
  expect(PacientesRepo.filtrar("rex", null)).toHaveLength(1);
  expect(PacientesRepo.filtrar("mestizo", null)).toHaveLength(3);
  expect(PacientesRepo.filtrar("zzz", null)).toHaveLength(0);
});

test("pacientes_unAnimalSinTipoPropioCuentaComoOtro", async () => {
  fuente.mascotas.push(Escenario.mascota("m5", "Bola", Escenario.DUENO_ID, "Erizo"));
  fuente.accesosGuardados.push(accesoDto("a5", "m5", Escenario.VET_ID, "activo", "dueno"));
  await ingresarComoVeterinario();

  expect(PacientesRepo.filtrar("", PacientesRepo.ESPECIE_OTRO).map((p) => p.nombre)).toEqual(["Bola"]);
});

test("tiposDeMascota_incluyenAvesReptilesPecesYRoedores", () => {
  expect(TiposMascota.TODOS).toEqual([
    "Perro", "Gato", "Ave", "Reptil", "Pez", "Roedor", "Conejo", "Hurón", "Caballo", "Cerdo", "Otro",
  ]);
  expect(TiposMascota.plural("Pez")).toBe("Peces");
  expect(TiposMascota.plural("Hurón")).toBe("Hurones");
  expect(TiposMascota.plural("Erizo")).toBe("Otros");
});

test("tiposDeMascota_comparanSinTildesNiMayusculas", () => {
  expect(TiposMascota.normalizar("huron")).toBe("Hurón");
  expect(TiposMascota.normalizar(" CONEJO ")).toBe("Conejo");
  expect(TiposMascota.normalizar("Erizo")).toBe("Otro");
  expect(TiposMascota.esConocido("hurón")).toBe(true);
});

test("pacientes_traenLosDatosDelDuenoYLaMascota", async () => {
  await ingresarComoVeterinario();

  const rex = PacientesRepo.porId("m1")!;
  expect(rex.sexo).toBe("Macho");
  expect(rex.peso).toBe("12 kg");
  expect(rex.nacimiento.startsWith("15 Mar 2020")).toBe(true);
});

test("agregarManual_creaLaMascotaConLosDatosDelPropietario", async () => {
  await ingresarComoVeterinario();

  const nuevo = PacientesRepo.agregarManual("Toby", "Perro", "", "Macho", "Carlos Gómez", "1144443333");
  await asentar();

  expect(PacientesRepo.porId(nuevo.id)).not.toBeNull();
  expect(nuevo.raza).toBe("Perro");
  expect(fuente.llamadas).toContain("crearMascota:Toby");
  expect(fuente.mascotas[fuente.mascotas.length - 1].propietario_nombre).toBe("Carlos Gómez");
});

// ---------- Cuenta del dueño ----------

test("cuentaDueno_creaLaMascotaYElPacienteQuedaConCuenta", async () => {
  await ingresarComoVeterinario();

  const cuenta = await PacientesRepo.crearCuentaDueno("Carlos Gómez", "30111222", "11 4444 3333", "Carlos@Prueba.test", "", [
    { nombre: "Toby", tipo: "Perro", sexo: "macho" },
  ]);

  expect(cuenta.email).toBe("carlos@prueba.test");
  expect(cuenta.passwordTemporal).toBe("Temp1234ab");
  expect(cuenta.mascotas).toEqual(["Toby"]);
  expect(fuente.ultimaCuentaPedida?.email).toBe("carlos@prueba.test");
  const toby = PacientesRepo.pacientes.find((p) => p.nombre === "Toby")!;
  expect(toby.tieneCuenta).toBe(true);
});

test("cuentaDueno_vinculaLosPacientesYaCargadosDelMismoPropietario", async () => {
  await ingresarComoVeterinario();
  const toby = PacientesRepo.agregarManual("Toby", "Perro", "", "Macho", "Carlos Gómez", "1144443333", "", "30111222");
  const luna = PacientesRepo.agregarManual("Luna", "Gato", "", "Hembra", "Carlos Gómez", "1144443333", "", "30111222");
  PacientesRepo.agregarManual("Otro", "Perro", "", "Macho", "Ana Suárez", "1100000000", "", "20999888");
  await asentar();
  expect(toby.tieneCuenta).toBe(false);

  const mismos = PacientesRepo.mismoPropietarioSinCuenta(toby);
  expect(mismos.map((p) => p.nombre)).toEqual(["Toby", "Luna"]);

  await PacientesRepo.crearCuentaDueno("Carlos Gómez", "30111222", "1144443333", "carlos@prueba.test", "", [], mismos.map((p) => p.id));

  expect(fuente.ultimaCuentaPedida?.mascotas_existentes).toEqual([toby.id, luna.id]);
  expect(fuente.ultimaCuentaPedida!.mascotas_nuevas).toHaveLength(0);
  expect(PacientesRepo.porId(toby.id)!.tieneCuenta).toBe(true);
  expect(PacientesRepo.porId(luna.id)!.tieneCuenta).toBe(true);
  expect(PacientesRepo.pacientes.filter((p) => !p.tieneCuenta)).toHaveLength(1);
});

test("cuentaDueno_elErrorDelServidorLlegaTalCualYNoCambiaNada", async () => {
  await ingresarComoVeterinario();
  fuente.errorAlCrearCuenta = "Ese DNI ya tiene una cuenta en PetCare.";
  const antes = PacientesRepo.pacientes.length;

  const error = await PacientesRepo.crearCuentaDueno("Carlos Gómez", "30111222", "1144443333", "carlos@prueba.test", "", [
    { nombre: "Toby", tipo: "Perro" },
  ]).then(
    () => null,
    (e: Error) => e,
  );

  expect(error?.message).toBe("Ese DNI ya tiene una cuenta en PetCare.");
  expect(PacientesRepo.pacientes).toHaveLength(antes);
});

// ---------- Agenda ----------

test("agenda_agregarCreaElTurnoPropioYLoOrdena", async () => {
  await ingresarComoVeterinario();

  const turno = AgendaRepo.agregar("m1", "Vacuna", "Refuerzo", hoy.plusDays(1), "10:00", "PENDIENTE", "");
  AgendaRepo.agregar("m2", "Control", "Control", hoy.plusDays(1), "09:00", "PENDIENTE", "");
  await asentar();

  expect(fuente.turnosGuardados[0].veterinario_id).toBe(Escenario.VET_ID);
  expect(fuente.turnosGuardados[0].motivo).toBe("Refuerzo");
  expect(AgendaRepo.proximos().map((e) => e.hora)).toEqual(["09:00", "10:00"]);
  expect(AgendaRepo.proximoEvento("m1")).toBe(turno);
});

test("agenda_cambiarEstadoYGuardarCambios", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"));
  await ingresarComoVeterinario();
  const turno = AgendaRepo.porId("t1")!;

  AgendaRepo.cambiarEstado(turno, "COMPLETADO");
  await asentar();
  expect(fuente.turnosGuardados[0].estado).toBe("completado");
  expect(AgendaRepo.deHoy()).toHaveLength(0);
  expect(AgendaRepo.ultimaConsulta("m1")).toBe(turno);

  turno.motivo = "Otro motivo";
  turno.hora = "11:30";
  AgendaRepo.guardar(turno);
  await asentar();
  expect(fuente.llamadas.some((l) => l.startsWith("turno:t1:") && l.includes("hora=11:30:00") && l.includes("motivo=Otro motivo"))).toBe(true);
});

test("agenda_elMotivoVacioMuestraLaCategoria", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"));
  await ingresarComoVeterinario();

  expect(AgendaRepo.porId("t1")!.motivo).toBe("Control");
  expect(AgendaRepo.pacientesHoy()).toBe(1);
});

test("agenda_pacientesHoyCuentaLosYaAtendidosPeroNoLosCancelados", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00", Escenario.VET_ID, "completado"));
  fuente.turnosGuardados.push(Escenario.turno("t2", "m2", hoy.toString(), "11:00:00"));
  fuente.turnosGuardados.push(Escenario.turno("t3", "m4", hoy.toString(), "12:00:00", Escenario.VET_ID, "cancelado"));
  await ingresarComoVeterinario();

  expect(AgendaRepo.pacientesHoy()).toBe(2);
  expect(AgendaRepo.deHoy()).toHaveLength(1);
});

// ---------- Disponibilidad ----------

test("disponibilidad_validaDiaHorarioYSuperposicion", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", proximoLunes().toString(), "10:00:00"));
  await ingresarComoVeterinario();
  const lunes = proximoLunes();

  expect(DisponibilidadVet.validar(lunes, "09:00")).toBeNull();
  expect(DisponibilidadVet.validar(hoy.minusDays(1), "09:00")).toBe("No podés seleccionar una fecha que ya pasó");
  expect(DisponibilidadVet.validar(lunes.plusDays(5), "09:00")!.startsWith("No atendés")).toBe(true);
  expect(DisponibilidadVet.validar(lunes, "13:00")!).toContain("fuera de tu atención");
  expect(DisponibilidadVet.validar(lunes, "10:00")).toBe("Ya tenés un turno en ese horario");
  expect(DisponibilidadVet.validar(lunes, "10:15")).toBe("Ya tenés un turno en ese horario");
  expect(DisponibilidadVet.validar(lunes, "10:00", 30, "t1")).toBeNull();
});

test("disponibilidad_listaLosHorariosDeLaFranjaMarcandoLosOcupados", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", proximoLunes().toString(), "09:30:00"));
  await ingresarComoVeterinario();

  const horarios = DisponibilidadVet.horarios(proximoLunes());

  expect(horarios).toHaveLength(6);
  expect(horarios[0].hora).toBe("09:00");
  expect(horarios.find((h) => h.hora === "09:30")!.libre).toBe(false);
  expect(horarios.find((h) => h.hora === "10:00")!.libre).toBe(true);
  expect(DisponibilidadVet.horarios(proximoLunes().plusDays(5))).toHaveLength(0);
});

test("disponibilidad_unTurnoLargoBloqueaLosHorariosQueCubre", async () => {
  fuente.turnosGuardados.push({ ...Escenario.turno("t1", "m1", proximoLunes().toString(), "09:00:00"), duracion_min: 90 });
  await ingresarComoVeterinario();
  const lunes = proximoLunes();

  expect(DisponibilidadVet.validar(lunes, "10:00", 30)).toBe("Ya tenés un turno en ese horario");
  expect(DisponibilidadVet.validar(lunes, "10:30", 30)).toBeNull();
  const horarios = DisponibilidadVet.horarios(lunes, 30);
  expect(horarios.find((h) => h.hora === "10:00")!.libre).toBe(false);
  expect(horarios.find((h) => h.hora === "10:30")!.libre).toBe(true);
});

test("disponibilidad_unTurnoQueNoTerminaAntesDelCierreSeRechaza", async () => {
  await ingresarComoVeterinario();
  const lunes = proximoLunes();

  // Atiende de 09:00 a 12:00: una práctica de 2 horas no puede arrancar a las 11:00
  expect(DisponibilidadVet.validar(lunes, "11:00", 120)!).toContain("no llega a terminar");
  expect(DisponibilidadVet.horarios(lunes, 120).map((h) => h.hora)).toEqual(["09:00", "09:30", "10:00"]);
});

test("perfil_cargaYGuardaLosTiposDeAnimalYLasDuraciones", async () => {
  await ingresarComoVeterinario();
  PerfilVetRepo.cargar(
    Escenario.perfil(Escenario.VET_ID, "veterinario", "Dr. Vera", {
      veterinario: { matricula: "MP-100", tipos_animales: ["Gato"], duraciones: { Tomografía: 90 } },
    }),
  );
  expect(new Set(PerfilVetRepo.tiposAnimales)).toEqual(new Set(["Gato"]));
  expect(PerfilVetRepo.duracionDe("Tomografía")).toBe(90);
  expect(PerfilVetRepo.duracionDe("Chequeo médico integral")).toBe(30);
  expect(PerfilVetRepo.atiende("Gato")).toBe(true);
  expect(PerfilVetRepo.atiende("Perro")).toBe(false);
  // Un animal sin nombre propio cuenta como "Otro"
  expect(PerfilVetRepo.atiende("Erizo")).toBe(false);

  PerfilVetRepo.tiposAnimales.add("Otro");
  PerfilVetRepo.guardarTiposAnimales();
  PerfilVetRepo.duraciones["Cirugía 24hs"] = 150;
  PerfilVetRepo.guardarDuraciones();
  await asentar();

  expect(PerfilVetRepo.atiende("Erizo")).toBe(true);
  expect(fuente.llamadas).toContain("veterinario:tipos_animales");
  expect(fuente.llamadas).toContain("veterinario:duraciones");
  expect(PerfilVetRepo.duracionDe("Cirugía 24hs")).toBe(150);
});

// ---------- Carnet de salud ----------

test("salud_calculaElEstadoDeVacunasYTratamientos", async () => {
  const registro = (id: string, tipo: string, titulo: string, fecha: LocalDate, fin: LocalDate | null = null, proxima: LocalDate | null = null): RegistroSaludDto => ({
    id, mascota_id: "m1", tipo, titulo, detalle: null, fecha: fecha.toString(), fecha_fin: fin?.toString() ?? null,
    proxima_dosis: proxima?.toString() ?? null,
  });
  fuente.registros.push(registro("r1", "vacuna", "Rabia", hoy.minusDays(300), null, hoy.plusDays(60)));
  fuente.registros.push(registro("r2", "vacuna", "Triple", hoy.minusDays(300), null, hoy.plusDays(10)));
  fuente.registros.push(registro("r3", "vacuna", "Parvo", hoy.minusDays(400), null, hoy.minusDays(5)));
  fuente.registros.push(registro("r4", "tratamiento", "Antibiótico", hoy.minusDays(10), hoy.minusDays(3)));
  fuente.registros.push(registro("r5", "tratamiento", "Dieta", hoy.minusDays(2)));
  await ingresarComoVeterinario();

  const estado = (id: string) => SaludRepo.registros.find((r) => r.id === id)!.estado;
  expect(estado("r1")).toBe("Al día");
  expect(estado("r2")).toBe("Próxima");
  expect(estado("r3")).toBe("Vencida");
  expect(estado("r4")).toBe("Finalizado");
  expect(estado("r5")).toBe("Activo");
  expect(SaludRepo.registros[0].mascota).toBe("Rex");
  expect(SaludRepo.filtrar("VACUNA", "", "m1")).toHaveLength(3);
  expect(SaludRepo.filtrar("TRATAMIENTO", "dieta", null)).toHaveLength(1);
});

test("salud_agregarYEliminar", async () => {
  await ingresarComoVeterinario();

  const registro = SaludRepo.agregar("VACUNA", "m1", "Rabia", null, hoy, null, hoy.plusDays(365));
  await asentar();
  expect(fuente.llamadas).toContain("crearRegistro:vacuna:Rabia");
  expect(SaludRepo.filtrar("VACUNA", "", null)).toHaveLength(1);

  SaludRepo.eliminar(registro);
  await asentar();
  expect(SaludRepo.registros).toHaveLength(0);
  expect(fuente.llamadas.some((l) => l.startsWith("eliminarRegistro:"))).toBe(true);
});

test("salud_laVacunaGuardaMarcaLoteYVencimientoDelLote", async () => {
  await ingresarComoVeterinario();

  const registro = SaludRepo.agregar("VACUNA", "m1", "Antirrábica", null, hoy, null, hoy.plusDays(365), null, "Nobivac", "A123", hoy.plusDays(400));
  await asentar();

  const enviado = fuente.ultimoRegistroCreado!;
  expect(enviado.marca).toBe("Nobivac");
  expect(enviado.lote).toBe("A123");
  expect(enviado.lote_vencimiento).toBe(hoy.plusDays(400).toString());
  expect(registro.detalle.includes("Nobivac") && registro.detalle.includes("Lote A123")).toBe(true);
});

test("salud_vacunasARecordarSonLasVencidasYLasQueVencenPronto", async () => {
  fuente.registros.push({ id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", detalle: null, fecha: hoy.minusDays(300).toString(), fecha_fin: null, proxima_dosis: hoy.minusDays(10).toString() });
  fuente.registros.push({ id: "r2", mascota_id: "m2", tipo: "vacuna", titulo: "Triple", detalle: null, fecha: hoy.toString(), fecha_fin: null, proxima_dosis: hoy.plusDays(15).toString() });
  fuente.registros.push({ id: "r3", mascota_id: "m1", tipo: "vacuna", titulo: "Moquillo", detalle: null, fecha: hoy.toString(), fecha_fin: null, proxima_dosis: hoy.plusDays(200).toString() });
  await ingresarComoVeterinario();

  expect(SaludRepo.vacunasARecordar().map((r) => r.titulo)).toEqual(["Rabia", "Triple"]);
});

test("informe_guardaAnamnesisExamenYSignosVitales", async () => {
  await ingresarComoVeterinario();

  InformesRepo.guardar("m1", "Control", "Otitis", "Gotas", null, "Se rasca la oreja", "Oído rojo", {
    pesoKg: 12.4, temperaturaC: 38.5, frecuenciaCardiaca: 90, frecuenciaRespiratoria: 22,
  });
  await asentar();

  const creado = fuente.ultimoInformeCreado!;
  expect(creado.anamnesis).toBe("Se rasca la oreja");
  expect(creado.examen_fisico).toBe("Oído rojo");
  expect(creado.peso_kg).toBeCloseTo(12.4, 3);
  expect(creado.temperatura_c).toBeCloseTo(38.5, 3);
  expect(creado.frecuencia_cardiaca).toBe(90);
  expect(creado.frecuencia_respiratoria).toBe(22);
  expect(signosTexto(InformesRepo.obtener("m1").signos)).toBe("Peso 12.4 kg · Temp. 38.5 °C · FC 90 lpm · FR 22 rpm");
});

test("informe_alVolverAGuardarActualizaLosSignos", async () => {
  await ingresarComoVeterinario();
  InformesRepo.guardar("m1", "Control", "Otitis", "Gotas", null, "", "", { pesoKg: 12.0 });
  await asentar();

  InformesRepo.guardar("m1", "Control", "Otitis", "Gotas", null, "", "", { pesoKg: 12.6 });
  await asentar();

  const cambios = fuente.ultimosCambiosDeInforme!;
  expect(String(cambios["peso_kg"])).toBe("12.6");
});

test("informe_cargaLosSignosYLaEvolucionDelPeso", async () => {
  const hace60 = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  fuente.informes.push({
    id: "i1", mascota_id: "m1", turno_id: null, veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Sano",
    tratamiento: null, created_at: hace60, peso_kg: 11.0, temperatura_c: 38.2,
  });
  fuente.informes.push({
    id: "i2", mascota_id: "m1", turno_id: "t9", veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Sano",
    tratamiento: null, created_at: new Date().toISOString(), peso_kg: 12.5,
  });
  await ingresarComoVeterinario();

  const general = await InformesRepo.cargar("m1", null);
  const pesos = await InformesRepo.pesos("m1");

  expect(general.signos.pesoKg).toBeCloseTo(11.0, 3);
  expect(pesos).toHaveLength(2);
  expect(pesos.map((p) => p[1])).toEqual([11.0, 12.5]);
});

test("receta_seAgregaYSeQuitaDeLaConsulta", async () => {
  await ingresarComoVeterinario();

  const p = PrescripcionesRepo.agregar("m1", "t1", "Amoxicilina", "250 mg", 8, 7, "Con comida");
  await asentar();

  expect(fuente.llamadas).toContain("crearPrescripcion:Amoxicilina");
  expect(posologia(p)).toBe("250 mg, cada 8 hs, durante 7 días");
  expect(PrescripcionesRepo.deConsulta("m1", "t1").map((x) => x.medicamento)).toEqual(["Amoxicilina"]);
  expect(PrescripcionesRepo.deConsulta("m1", "otro")).toHaveLength(0);

  PrescripcionesRepo.eliminar(p);
  await asentar();
  expect(PrescripcionesRepo.deConsulta("m1", "t1")).toHaveLength(0);
  expect(fuente.llamadas.some((l) => l.startsWith("eliminarPrescripcion:"))).toBe(true);
});

test("informe_elPesoMedidoPasaAlPacienteEnSeguida", async () => {
  await ingresarComoVeterinario();
  expect(PacientesRepo.porId("m1")!.peso).toBe("12 kg");

  InformesRepo.guardar("m1", "Control", "Sano", "", null, "", "", { pesoKg: 13.4 });
  await asentar();

  expect(PacientesRepo.porId("m1")!.peso).toBe("13.4 kg");
});

test("pacientes_laAlertaClinicaSeGuardaYSeVeEnLaFicha", async () => {
  await ingresarComoVeterinario();

  PacientesRepo.guardarAlertas("m1", "  Alérgico a la penicilina ");
  await asentar();

  expect(PacientesRepo.porId("m1")!.alertas).toBe("Alérgico a la penicilina");
  expect(fuente.llamadas).toContain("alertas:m1:Alérgico a la penicilina");
});

// ---------- Solicitudes ----------

test("solicitudes_listaLasQueEnviaronLosDuenosYLasQuePidioElVeterinario", async () => {
  fuente.accesosGuardados.push({ ...accesoDto("a9", "m3", Escenario.VET_ID, "pendiente", "dueno"), created_at: "2026-01-01T10:00:00+00:00" });
  await ingresarComoVeterinario();

  expect(SolicitudesRepo.pendientesVeterinario()).toBe(2);
  const recibida = SolicitudesRepo.paraVeterinario.find((s) => !s.enviada)!;
  expect(recibida.mascota).toBe("Quiere compartir a Sin acceso");
  const enviada = SolicitudesRepo.paraVeterinario.find((s) => s.enviada)!;
  expect(enviada.mascota).toBe("Pediste acceso a Sin acceso");
  expect(enviada.estado).toBe("PENDIENTE");
});

test("solicitudes_laQuePidioElVeterinarioMuestraLaRespuestaDelDueno", async () => {
  const i = fuente.accesosGuardados.findIndex((a) => a.id === "a3");
  fuente.accesosGuardados[i] = { ...fuente.accesosGuardados[i], estado: "rechazado" };
  await ingresarComoVeterinario();

  expect(SolicitudesRepo.paraVeterinario).toHaveLength(1);
  const enviada = SolicitudesRepo.paraVeterinario[0];
  expect(enviada.enviada).toBe(true);
  expect(enviada.estado).toBe("RECHAZADA");
  expect(SolicitudesRepo.pendientesVeterinario()).toBe(0);
});

test("solicitudes_aceptarSumaLaMascotaALosPacientes", async () => {
  fuente.accesosGuardados.push(accesoDto("a9", "m3", Escenario.VET_ID, "pendiente", "dueno"));
  await ingresarComoVeterinario();
  expect(PacientesRepo.porId("m3")).toBeNull();

  SolicitudesRepo.resolver(SolicitudesRepo.paraVeterinario.find((s) => s.id === "a9")!, true);
  await asentar();

  expect(fuente.accesosGuardados.find((a) => a.id === "a9")!.estado).toBe("activo");
  expect(PacientesRepo.porId("m3")).not.toBeNull();
});

// ---------- Informes y archivos ----------

test("informes_seCreanUnaVezYDespuesSeActualizan", async () => {
  await ingresarComoVeterinario();

  InformesRepo.guardar("m1", "Picazón", "Alergia", "Antihistamínico");
  await asentar();
  expect(fuente.llamadas).toContain("crearInforme:m1");

  InformesRepo.guardar("m1", "Picazón", "Alergia leve", "Antihistamínico");
  await asentar();
  expect(fuente.llamadas.some((l) => l.startsWith("actualizarInforme:"))).toBe(true);
  expect(InformesRepo.obtener("m1").diagnostico).toBe("Alergia leve");
});

test("informes_cargaElUltimoInformePropio", async () => {
  fuente.informes.push({ id: "i1", mascota_id: "m1", turno_id: null, veterinario_id: "otro-vet", motivo: "Ajeno", diagnostico: "x", tratamiento: "y" });
  fuente.informes.push({ id: "i2", mascota_id: "m1", turno_id: null, veterinario_id: Escenario.VET_ID, motivo: "Propio", diagnostico: "Dx", tratamiento: "Tx" });
  await ingresarComoVeterinario();

  const informe = await InformesRepo.cargar("m1");

  expect(informe.motivo).toBe("Propio");
  expect(informe.id).toBe("i2");
});

test("archivos_subirRegistraElArchivoEnLaFicha", async () => {
  await ingresarComoVeterinario();

  const item = await ArchivosRepo.agregar("m1", "Radiografía", "pdf", new Uint8Array(10), "application/pdf");

  expect(fuente.subidas).toHaveLength(1);
  expect(fuente.subidas[0].startsWith("archivos/m1/")).toBe(true);
  expect(item.tipoExtension).toBe("PDF");
  expect(ArchivosRepo.dePaciente("m1")).toEqual([item]);

  ArchivosRepo.renombrar(item, "Rx de tórax");
  await asentar();
  expect(ArchivosRepo.dePaciente("m1")[0].nombre).toBe("Rx de tórax");
  ArchivosRepo.eliminar(ArchivosRepo.dePaciente("m1")[0]);
  await asentar();
  expect(ArchivosRepo.dePaciente("m1")).toHaveLength(0);
});

test("archivos_adjuntadosAlInformeQuedanLigadosAlTurno", async () => {
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"));
  await ingresarComoVeterinario();

  await ArchivosRepo.agregar("m1", "Estudio", "pdf", new Uint8Array(5), "application/pdf", "t1");
  await ArchivosRepo.agregar("m1", "Suelto", "pdf", new Uint8Array(5), "application/pdf");
  await ArchivosRepo.cargar("m1");

  expect(ArchivosRepo.deTurno("m1", "t1").map((a) => a.nombre)).toEqual(["Estudio"]);
  expect(ArchivosRepo.dePaciente("m1")).toHaveLength(2);
  expect(fuente.archivos.find((a) => a.nombre === "Estudio")!.turno_id).toBe("t1");
});

// ---------- Perfil ----------

test("perfil_guardaHorariosEspecialidadesYPreferencias", async () => {
  await ingresarComoVeterinario();

  const principal = PerfilVetRepo.sede(null)!;
  PerfilVetRepo.guardarSede({ ...principal, dias: [...principal.dias, 6], cierre: "14:00" });
  PerfilVetRepo.especialidadesSeleccionadas[PerfilVetRepo.todasLasEspecialidades.indexOf("Dermatología")] = true;
  PerfilVetRepo.guardarEspecialidades();
  PerfilVetRepo.preferencias["notif_turnos"] = false;
  PerfilVetRepo.guardarPreferencias();
  await asentar();

  expect(fuente.llamadas).toContain("veterinario:clinica,dias_atencion,direccion_clinica,hora_apertura,hora_cierre");
  expect(fuente.llamadas).toContain("veterinario:especialidades");
  expect(fuente.llamadas).toContain("perfil:preferencias");
  expect(PerfilVetRepo.preferencia("notif_turnos")).toBe(false);
  expect(PerfilVetRepo.preferencia("notif_solicitudes")).toBe(true);
  expect(PerfilVetRepo.textoHorarios()).toContain("Sábado");
  expect(PerfilVetRepo.textoEspecialidades()).toContain("Dermatología");
});

// ---------- Lugares de atención ----------

test("lugares_sinLugaresEnElServidorSeArmaUnoConLosDatosDeSiempre", async () => {
  await ingresarComoVeterinario();

  expect(PerfilVetRepo.sedes).toHaveLength(1);
  const unico = PerfilVetRepo.sedes[0];
  expect(unico.nombre).toBe("Clínica Sur");
  expect(unico.direccion).toBe("Av. Siempreviva 742");
  expect(new Set(unico.dias)).toEqual(new Set([1, 2, 3, 4, 5]));
  expect(unico.cierre).toBe("12:00");
});

test("lugares_agregaEditaYQuitaLugaresDeAtencion", async () => {
  await ingresarComoVeterinario();

  PerfilVetRepo.agregarSede(crearSede({ id: "", nombre: "Consultorio Centro", direccion: "San Martín 100", dias: [6], apertura: "10:00", cierre: "14:00" }));
  await asentar();
  expect(PerfilVetRepo.sedes).toHaveLength(2);
  expect(fuente.llamadas).toContain("crearSede:Consultorio Centro");

  await Sesion.recargarPerfil();
  expect(PerfilVetRepo.sedes.map((s) => s.nombre)).toEqual(["Clínica Sur", "Consultorio Centro"]);
  // El principal sigue siendo el primero: lo "de siempre" lo refleja
  expect(PerfilVetRepo.clinica).toBe("Clínica Sur");

  const centro = PerfilVetRepo.sedes[1];
  PerfilVetRepo.guardarSede({ ...centro, cierre: "13:00" });
  await asentar();
  expect(PerfilVetRepo.sedes[1].cierre).toBe("13:00");
  expect(fuente.llamadas.some((l) => l.startsWith(`actualizarSede:${centro.id}:`))).toBe(true);

  PerfilVetRepo.eliminarSede(centro.id);
  await asentar();
  expect(PerfilVetRepo.sedes).toHaveLength(1);
  expect(fuente.llamadas).toContain(`eliminarSede:${centro.id}`);

  // El único lugar que queda no se puede quitar
  PerfilVetRepo.eliminarSede(PerfilVetRepo.sedes[0].id);
  expect(PerfilVetRepo.sedes).toHaveLength(1);
});

test("lugares_noSePuedeTenerMasDelMaximo", async () => {
  await ingresarComoVeterinario();

  for (let i = 0; i < PerfilVetRepo.MAX_SEDES + 2; i++) {
    PerfilVetRepo.agregarSede(crearSede({ id: "", nombre: `Lugar ${i}`, direccion: "", dias: [1], apertura: "09:00", cierre: "10:00" }));
  }
  await asentar();

  expect(PerfilVetRepo.sedes).toHaveLength(PerfilVetRepo.MAX_SEDES);
});

test("lugares_cadaLugarTieneSusPropiosDiasYHorarios", async () => {
  await ingresarComo(Escenario.veterinarioEnDosLugares());
  const lunes = proximoLunes();
  const sabado = lunes.plusDays(5);
  const a = PerfilVetRepo.sede("sede-a")!;
  const b = PerfilVetRepo.sede("sede-b")!;

  expect(DisponibilidadVet.validar(lunes, "09:00", 30, null, a)).toBeNull();
  expect(DisponibilidadVet.validar(lunes, "10:00", 30, null, b)!.startsWith("No atendés")).toBe(true);
  expect(DisponibilidadVet.validar(sabado, "10:00", 30, null, b)).toBeNull();
  expect(DisponibilidadVet.validar(sabado, "09:00", 30, null, b)!).toContain("fuera de tu atención");
  // Sin indicar el lugar se usa el principal
  expect(DisponibilidadVet.validar(sabado, "10:00")!.startsWith("No atendés")).toBe(true);
  expect(DisponibilidadVet.horarios(sabado, 30, null, b).map((h) => h.hora)).toEqual([
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  ]);
});

test("lugares_unTurnoEnUnLugarOcupaElHorarioDelOtro", async () => {
  // El veterinario no puede estar en dos lugares a la vez: la agenda es una sola
  await ingresarComo(Escenario.veterinarioEnDosLugares());
  const sabado = proximoLunes().plusDays(5);
  fuente.turnosGuardados.push({ ...Escenario.turno("t9", "m1", sabado.toString(), "10:00:00"), sede_id: "sede-a" });
  await AgendaRepo.cargar();

  const b = PerfilVetRepo.sede("sede-b")!;
  expect(DisponibilidadVet.validar(sabado, "10:00", 30, null, b)).toBe("Ya tenés un turno en ese horario");
});

test("lugares_elTurnoGuardaElLugarElegido", async () => {
  await ingresarComo(Escenario.veterinarioEnDosLugares());
  const sabado = proximoLunes().plusDays(5);

  const evento = AgendaRepo.agregar("m1", "Control", "Control", sabado, "10:00", "PENDIENTE", "", "sede-b");
  await asentar();

  expect(evento.sedeId).toBe("sede-b");
  expect(fuente.turnosGuardados.find((t) => t.id === evento.id)!.sede_id).toBe("sede-b");
});
