/* Migrado de data/repositorio/DuenoRepo.kt */
import { CatalogoMedico } from "../catalogoMedico";
import { AvisosDelSistema } from "../avisos/avisosDelSistema";
import { Recordatorios } from "../avisos/recordatorios";
import {
  AccesoDto, atiendeComoVeterinario, DuenoMascotaDto, HoraOcupadaDto, InvitacionCoduenoDto, Json, lugaresDe, MascotaDto,
  NotificacionDto, PerfilDto, PrescripcionDto, RegistroSaludDto, TomaDto, TurnoDto,
} from "../remoto/dtos";
import { claveDeToma, tomasDelDia as tomasDeLaReceta } from "../../model/tomas";
import { Servicios } from "../servicios";
import { CuentaActual } from "../cuentaActual";
import { prescripcionDeDto, signosVacios } from "../../model/clinica";
import type { Prescripcion, SignosVitales } from "../../model/clinica";
import {
  EstadoAcceso, EstadoMascota, EstadosMascota, EventoMascota, Mascota, NotificacionDueno, PerfilDueno,
  SIN_DATOS, sexoDeTexto, tipoNotificacionDeClave, VeterinarioAcceso,
} from "../../model/modelos";
import type { AjusteFoto, SedeVet } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import { Fechas } from "../../util/fechas";
import { LocalDate, LocalDateTime, Reloj, YearMonth } from "../../util/tiempo";
import { Imagenes } from "../imagenes";
import { ArchivosRepo } from "./archivosRepo";
import { RecordatoriosRepo } from "./recordatoriosRepo";
import { SolicitudItem } from "./solicitudesRepo";

/** Todo lo que pertenece a la cuenta del dueño en sesión. */
class EstadoDueno {
  constructor(
    public perfil: PerfilDueno = new PerfilDueno("", "", "", ""),
    readonly mascotas: Mascota[] = [],
    readonly eventos: EventoMascota[] = [],
    readonly autorizados: VeterinarioAcceso[] = [],
    readonly disponibles: VeterinarioAcceso[] = [],
    readonly solicitudes: SolicitudItem[] = [],
    readonly notificaciones: NotificacionDueno[] = [],
    public accesos: AccesoDto[] = [],
    public veterinarios: Map<string, PerfilDto> = new Map(),
    /** Vacunas y recetas de sus mascotas: de acá salen los recordatorios de próxima dosis y de medicación. */
    public salud: RegistroSaludDto[] = [],
    public recetas: PrescripcionDto[] = [],
    public ultimaCargaSalud: number = 0,
    /** Invitaciones a ser co-dueño de una mascota que todavía no se respondieron. */
    public invitaciones: InvitacionCoduenoDto[] = [],
    /** Tomas de medicación ya tildadas. */
    public tomas: TomaDto[] = [],
  ) {}
}

/** Una toma de medicación del día, lista para tildar. */
export interface TomaDelDia {
  /** Hora programada como la guarda la base ("2026-11-24T08:00:00"). */
  clave: string;
  receta: Prescripcion;
  mascota: Mascota;
  momento: LocalDateTime;
  dada: boolean;
}

/** Un estudio anterior (ya guardado en la ficha) que el dueño adjunta a un turno. */
export class EstudioAdjunto {
  constructor(
    readonly nombre: string,
    readonly extension: string,
    readonly ruta: string,
    readonly tipo: string = "Estudio",
  ) {}
}

/** Una línea del historial de permisos ya con los nombres. */
export interface EntradaPermiso {
  cuando: LocalDateTime;
  evento: string;
  veterinario: string;
  mascota: string;
  actor: string;
  venceEl: LocalDate | null;
}

/** Un archivo que el veterinario subió a la ficha durante el turno. */
export class ArchivoDeTurno {
  constructor(
    readonly nombre: string,
    readonly extension: string,
    readonly ruta: string,
    readonly tipo: string = "",
  ) {}
}

/** Lo que dejó el veterinario en un turno: informe, vacunas o tratamientos cargados y archivos adjuntos. */
export class DetalleTurno {
  readonly motivo: string;
  readonly diagnostico: string;
  readonly tratamiento: string;
  readonly registros: string[];
  readonly archivos: ArchivoDeTurno[];
  /** Estudios anteriores que el propio dueño adjuntó al sacar el turno. */
  readonly estudios: ArchivoDeTurno[];
  readonly anamnesis: string;
  readonly examenFisico: string;
  readonly signos: SignosVitales;
  /** Medicamentos que recetó el veterinario en esa consulta. */
  readonly receta: Prescripcion[];

  constructor(d: {
    motivo: string;
    diagnostico: string;
    tratamiento: string;
    registros: string[];
    archivos: ArchivoDeTurno[];
    estudios?: ArchivoDeTurno[];
    anamnesis?: string;
    examenFisico?: string;
    signos?: SignosVitales;
    receta?: Prescripcion[];
  }) {
    this.motivo = d.motivo;
    this.diagnostico = d.diagnostico;
    this.tratamiento = d.tratamiento;
    this.registros = d.registros;
    this.archivos = d.archivos;
    this.estudios = d.estudios ?? [];
    this.anamnesis = d.anamnesis ?? "";
    this.examenFisico = d.examenFisico ?? "";
    this.signos = d.signos ?? {};
    this.receta = d.receta ?? [];
  }

  get vacio(): boolean {
    return (
      this.motivo.trim() === "" && this.diagnostico.trim() === "" && this.tratamiento.trim() === "" &&
      this.registros.length === 0 && this.archivos.length === 0 && this.estudios.length === 0 &&
      this.anamnesis.trim() === "" && this.examenFisico.trim() === "" && signosVacios(this.signos) &&
      this.receta.length === 0
    );
  }
}

const INTERVALO_SALUD_MS = 5 * 60 * 1000;

// ---------- Utilidades chicas ----------

const vacioONull = (t: string | null | undefined): string | null => (t == null || t.trim() === "" ? null : t);

/** Comparación de textos por unidades de código, como `String.compareTo` de Kotlin. */
const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const iguales = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function fechaDeTexto(t: string | null | undefined): LocalDate | null {
  if (t == null) return null;
  try {
    return LocalDate.parse(t);
  } catch {
    return null;
  }
}

/** Saca de la lista (en el lugar) todo lo que cumple la condición. */
function quitarSi<T>(lista: T[], cumple: (x: T) => boolean): void {
  for (let i = lista.length - 1; i >= 0; i--) if (cumple(lista[i])) lista.splice(i, 1);
}

function quitar<T>(lista: T[], x: T): void {
  const i = lista.indexOf(x);
  if (i >= 0) lista.splice(i, 1);
}

/** Lo que devuelve la consulta o una lista vacía si falla (`runCatching { }.getOrDefault(emptyList())`). */
async function oVacia<T>(accion: () => Promise<T[]>): Promise<T[]> {
  try {
    return await accion();
  } catch {
    return [];
  }
}

/** El texto de un valor JSON (lo que en Kotlin es `jsonPrimitive.content`); null si no hay o es nulo. */
function contenido(v: Json | undefined): string | null {
  if (v === undefined || v === null) return null;
  return typeof v === "object" ? null : String(v);
}

function numeroDe(v: Json | undefined): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function entero(texto: string): number {
  if (!/^[+-]?\d+$/.test(texto)) throw new Error(`Número inválido: ${texto}`);
  return parseInt(texto, 10);
}

const dos = (n: number) => String(n).padStart(2, "0");

function pesoDeTexto(texto: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)/.exec(texto);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function textoDePeso(kg: number | null | undefined): string {
  if (kg == null) return SIN_DATOS;
  if (kg % 1 === 0) return `${Math.trunc(kg)} kg`;
  return `${kg} kg`;
}

/** Un turno sigue "próximo" mientras no pasó su fecha y el veterinario no lo marcó como completado. */
function vigente(e: EventoMascota, hoy: LocalDate): boolean {
  return e.estado !== "COMPLETADO" && !e.fecha.isBefore(hoy);
}

const porFechaYHora = (a: EventoMascota, b: EventoMascota) => a.fecha.compareTo(b.fecha) || comparar(a.hora, b.hora);

/**
 * Datos del dueño en sesión. Guarda una copia en memoria de lo que dice el servidor para que las pantallas
 * lean sin esperar, y manda cada cambio a Supabase en segundo plano. Lo que el servidor genera solo (accesos
 * por turno, avisos) se vuelve a pedir después de cada cambio.
 */
class DuenoRepoImpl {
  readonly CATEGORIA_VACUNA = "Vacuna";

  /** Cada cuántos minutos arrancan los horarios que se ofrecen (la duración de cada turno es aparte). */
  readonly PASO_HORARIOS_MIN = 30;

  /** Clases de estudio que se pueden indicar al adjuntar un documento médico a un turno. */
  readonly TIPOS_ESTUDIO = [
    "Radiografía", "Análisis de sangre", "Ecografía", "Análisis de orina", "Electrocardiograma",
    "Receta o indicaciones", "Informe médico", "Otro estudio",
  ];

  private estado = new EstadoDueno();

  get perfil(): PerfilDueno { return this.estado.perfil; }
  get mascotas(): Mascota[] { return this.estado.mascotas; }
  get eventos(): EventoMascota[] { return this.estado.eventos; }
  get autorizados(): VeterinarioAcceso[] { return this.estado.autorizados; }
  get disponibles(): VeterinarioAcceso[] { return this.estado.disponibles; }
  get solicitudes(): SolicitudItem[] { return this.estado.solicitudes; }
  get notificaciones(): NotificacionDueno[] { return this.estado.notificaciones; }
  get hayNotificacionesSinLeer(): boolean { return this.estado.notificaciones.some((n) => !n.leida); }
  get notificacionesSinLeer(): number { return this.estado.notificaciones.filter((n) => !n.leida).length; }
  get invitaciones(): InvitacionCoduenoDto[] { return this.estado.invitaciones; }

  // ---------- Carga ----------

  limpiar(): void {
    this.estado = new EstadoDueno();
  }

  /** Pide al servidor todo lo del dueño y lo deja listo para las pantallas. */
  async cargar(perfilDto: PerfilDto): Promise<void> {
    const f = Servicios.fuente;
    const [mascotasDto, turnosDto, catalogo, accesosDto, avisosDelServidor] = await Promise.all([
      f.misMascotas(), f.turnos(), f.catalogoVeterinarios(), f.accesos(), f.notificaciones(),
    ]);

    const nuevo = new EstadoDueno(this.aPerfil(perfilDto));
    nuevo.mascotas.push(...mascotasDto.map((m) => this.aMascota(m)));
    nuevo.veterinarios = new Map(catalogo.map((p) => [p.id, p]));
    nuevo.accesos = accesosDto;
    nuevo.eventos.push(
      ...turnosDto
        .filter((t) => t.estado !== "cancelado" && nuevo.mascotas.some((m) => m.id === t.mascota_id))
        .map((t) => this.aEvento(t, nuevo)),
    );
    nuevo.notificaciones.push(...avisosDelServidor.map((n) => this.aNotificacion(n)));
    nuevo.invitaciones = await this.pedirInvitaciones([]);
    this.reconstruirVeterinarios(nuevo);
    this.estado = nuevo;
    try {
      await RecordatoriosRepo.cargar();
    } catch {
      // los recordatorios a mano se quedan como estaban
    }
    await this.cargarSalud(nuevo, true);
    // Al iniciar sesión lo que ya estaba no suena; solo se programan los recordatorios de lo que viene
    try {
      await AvisosDelSistema.mostrarNuevas(avisosDelServidor, true);
    } catch {
      // sin avisos del sistema
    }
    await this.programarAvisos(nuevo);
  }

  /**
   * Pone al día lo que el veterinario puede cambiar de una mascota (peso y alertas) sin tocar lo demás, que el
   * dueño edita y puede tener cambios pendientes de guardar.
   */
  private actualizarDatosClinicos(e: EstadoDueno, desdeElServidor: MascotaDto[]): void {
    for (const dto of desdeElServidor) {
      const propia = e.mascotas.find((m) => m.id === dto.id);
      if (!propia) continue;
      if (dto.peso_kg != null) propia.peso = textoDePeso(dto.peso_kg);
      propia.alertas = dto.alertas_clinicas ?? "";
    }
  }

  /**
   * Suma o saca las mascotas que cambiaron de dueños en el servidor (otra persona aceptó o dejó de compartirla, o te
   * quitaron como co-dueño). Las que siguen se dejan como están para no pisar cambios pendientes de guardar.
   */
  private sincronizarCompartidas(e: EstadoDueno, desdeElServidor: MascotaDto[]): void {
    // Solo las compartidas: una propia recién creada puede no haber llegado todavía al servidor
    const ids = new Set(desdeElServidor.map((m) => m.id));
    quitarSi(e.mascotas, (m) => m.compartida && !ids.has(m.id));
    for (const dto of desdeElServidor) {
      const nueva = this.aMascota(dto);
      if (nueva.compartida && !e.mascotas.some((m) => m.id === dto.id)) e.mascotas.push(nueva);
    }
  }

  /** Invitaciones sin responder; si falla el pedido se quedan las que había. */
  private async pedirInvitaciones(anteriores: InvitacionCoduenoDto[]): Promise<InvitacionCoduenoDto[]> {
    try {
      return await Servicios.fuente.misInvitacionesCodueno();
    } catch {
      return anteriores;
    }
  }

  /** Vacunas y recetas cambian poco: se piden al iniciar y después cada [INTERVALO_SALUD_MS]. */
  private async cargarSalud(e: EstadoDueno, forzar: boolean): Promise<void> {
    const ahora = Date.now();
    const f = Servicios.fuente;
    // Las tomas se piden siempre: las puede tildar otro dueño de la mascota
    try {
      e.tomas = await f.tomas();
    } catch {
      // se quedan las que había
    }
    if (!forzar && ahora - e.ultimaCargaSalud < INTERVALO_SALUD_MS) return;
    try {
      e.salud = await f.registrosSalud();
    } catch {
      // se queda lo que había
    }
    try {
      e.recetas = await f.prescripciones();
    } catch {
      // se queda lo que había
    }
    e.ultimaCargaSalud = ahora;
  }

  /** Turnos, próximas dosis de vacunas y tomas de medicación: todo lo que tiene que avisar el teléfono. */
  private async programarAvisos(e: EstadoDueno): Promise<void> {
    const ahora = LocalDateTime.now();
    const nombres = new Map(e.mascotas.map((m) => [m.id, m.nombre]));
    const vacunas = [];
    for (const r of e.salud) {
      if (!((r.tipo === "vacuna" || r.tipo === "desparasitacion") && nombres.has(r.mascota_id))) continue;
      const proxima = r.proxima_dosis != null ? fechaDeTexto(r.proxima_dosis) : null;
      if (!proxima) continue;
      const clase = r.tipo === "vacuna" ? "vacuna" : "desparasitación";
      vacunas.push({ id: r.id, mascota: nombres.get(r.mascota_id)!, vacuna: r.titulo, proxima, clase });
    }
    const medicacion = [];
    for (const p of e.recetas) {
      if (!nombres.has(p.mascota_id)) continue;
      const cada = p.frecuencia_horas;
      if (cada == null) continue;
      const dias = p.duracion_dias;
      if (dias == null) continue;
      let inicio: LocalDateTime | null;
      if (p.created_at != null) {
        inicio = Fechas.instante(p.created_at);
      } else {
        const dia = fechaDeTexto(p.inicio);
        inicio = dia ? dia.atTime(9, 0) : null;
      }
      if (!inicio) continue;
      medicacion.push({
        id: p.id, mascota: nombres.get(p.mascota_id)!, medicamento: p.medicamento, dosis: p.dosis ?? "",
        cadaHoras: cada, inicio, dias,
      });
    }
    const manuales = [];
    for (const r of RecordatoriosRepo.lista) {
      const mascota = nombres.get(r.mascotaId);
      if (mascota === undefined) continue;
      manuales.push({ id: r.id, mascota, titulo: r.titulo, fecha: r.fecha, hora: r.hora, nota: r.nota });
    }
    const avisos = [
      ...Recordatorios.paraDueno(e.eventos, ahora),
      ...Recordatorios.paraVacunas(vacunas, ahora, await AvisosDelSistema.vacunasAvisadas()),
      ...Recordatorios.paraMedicacion(medicacion, ahora),
      ...Recordatorios.paraManuales(manuales, ahora),
    ];
    await Recordatorios.programar(avisos, ahora);
  }

  /** Vuelve a pedir lo que el servidor modifica por su cuenta (accesos, avisos) y avisa a la pantalla. */
  async recargarDerivados(): Promise<void> {
    const f = Servicios.fuente;
    const actual = this.estado;
    const accesos = await f.accesos();
    const catalogo = await f.catalogoVeterinarios();
    const avisos = await f.notificaciones();
    const turnos = await f.turnos();
    actual.accesos = accesos;
    actual.veterinarios = new Map(catalogo.map((p) => [p.id, p]));
    // El veterinario actualiza el peso (y las alertas) de la mascota al guardar un informe
    try {
      const desdeElServidor = await f.misMascotas();
      this.sincronizarCompartidas(actual, desdeElServidor);
      this.actualizarDatosClinicos(actual, desdeElServidor);
    } catch {
      // se queda lo que había
    }
    actual.invitaciones = await this.pedirInvitaciones(actual.invitaciones);
    this.reconstruirVeterinarios(actual);
    actual.eventos.length = 0;
    actual.eventos.push(
      ...turnos
        .filter((t) => t.estado !== "cancelado" && actual.mascotas.some((m) => m.id === t.mascota_id))
        .map((t) => this.aEvento(t, actual)),
    );
    actual.notificaciones.length = 0;
    actual.notificaciones.push(...avisos.map((n) => this.aNotificacion(n)));
    try {
      await RecordatoriosRepo.cargar();
    } catch {
      // los recordatorios a mano se quedan como estaban
    }
    await this.cargarSalud(actual, false);
    try {
      await AvisosDelSistema.mostrarNuevas(avisos);
    } catch {
      // sin avisos del sistema
    }
    await this.programarAvisos(actual);
    Servicios.avisarCambio();
  }

  /** Descarta la copia local y vuelve a pedir todo; se usa cuando el servidor rechazó un cambio. */
  async recargarTodo(): Promise<void> {
    const perfilDto = await Servicios.fuente.miPerfil();
    await this.cargar(perfilDto);
    Servicios.avisarCambio();
  }

  private recargarAlTerminar = async (): Promise<void> => this.recargarDerivados();
  private recargarSiFalla = async (): Promise<void> => this.recargarTodo();

  // ---------- Conversión de filas ----------

  private aPerfil(p: PerfilDto): PerfilDueno {
    const ajuste = p.foto_ajuste;
    const nombreAjuste = contenido(ajuste?.["ajuste"]);
    const ajusteFoto: AjusteFoto =
      (["LLENAR", "COMPLETA", "CENTRADA"] as AjusteFoto[]).find((a) => a === nombreAjuste) ?? "LLENAR";
    return new PerfilDueno(p.nombre, p.email, p.telefono ?? "", p.direccion ?? "", {
      dni: p.perfiles_privados?.dni ?? "",
      fotoPath: p.foto_path ?? null,
      debeCambiarPassword: p.debe_cambiar_password,
      ajusteFoto,
      desplazamientoFotoX: numeroDe(ajuste?.["x"]) ?? 0,
      desplazamientoFotoY: numeroDe(ajuste?.["y"]) ?? 0,
    });
  }

  private aMascota(m: MascotaDto): Mascota {
    return new Mascota(m.nombre, m.tipo, {
      raza: m.raza ?? "",
      nacimiento: m.nacimiento != null ? fechaDeTexto(m.nacimiento) : null,
      sexo: sexoDeTexto(m.sexo),
      fotoPath: m.foto_path ?? null,
      id: m.id,
      peso: textoDePeso(m.peso_kg),
      microchip: vacioONull(m.microchip) ?? SIN_DATOS,
      color: vacioONull(m.color) ?? SIN_DATOS,
      observaciones: vacioONull(m.observaciones) ?? "Sin observaciones",
      alertas: m.alertas_clinicas ?? "",
      estado: (m.estado === "inactiva" || m.estado === "fallecida" || m.estado === "activa"
        ? m.estado.toUpperCase()
        : "ACTIVA") as EstadoMascota,
      compartida: m.dueno_id != null && CuentaActual.usuarioId != null && m.dueno_id !== CuentaActual.usuarioId,
    });
  }

  private aEvento(t: TurnoDto, e: EstadoDueno): EventoMascota {
    const mascota = e.mascotas.find((m) => m.id === t.mascota_id)?.nombre ?? "";
    return new EventoMascota(
      t.categoria, mascota, t.veterinario_id != null ? this.nombreVeterinario(e, t.veterinario_id) : "",
      t.hora.slice(0, 5), t.notas ?? "", LocalDate.parse(t.fecha),
      {
        id: t.id, mascotaId: t.mascota_id, veterinarioId: t.veterinario_id ?? null,
        estado: t.estado === "completado" ? "COMPLETADO" : "PENDIENTE",
        duracionMin: t.duracion_min, sedeId: t.sede_id ?? null,
      },
    );
  }

  private aNotificacion(n: NotificacionDto): NotificacionDueno {
    return new NotificacionDueno(
      tipoNotificacionDeClave(n.tipo), n.titulo, n.mensaje, Fechas.instante(n.created_at), n.leida, n.id,
    );
  }

  private nombreVeterinario(e: EstadoDueno, id: string): string {
    return e.veterinarios.get(id)?.nombre ?? "";
  }

  private aVeterinario(p: PerfilDto, estadoAcceso: EstadoAcceso, mascotas: Iterable<string>): VeterinarioAcceso {
    const datos = p.veterinarios ?? null;
    const sedes: SedeVet[] = (datos ? lugaresDe(datos) : []).map((it) => ({
      id: it.id,
      nombre: it.nombre,
      direccion: it.direccion ?? "",
      dias: [...new Set(it.dias_atencion)],
      apertura: it.hora_apertura.slice(0, 5),
      cierre: it.hora_cierre.slice(0, 5),
    }));
    const principal = sedes[0] ?? null;
    const especialidades = datos?.especialidades ?? [];
    return new VeterinarioAcceso(
      p.nombre, "@" + p.email.split("@")[0], p.email, datos?.matricula ?? "",
      especialidades.slice(0, 2).join(", ").trim() === "" ? "Chequeo médico integral" : especialidades.slice(0, 2).join(", "),
      estadoAcceso, mascotas,
      {
        id: p.id,
        fotoPath: p.foto_path ?? null,
        especialidades,
        diasAtencion: principal?.dias ?? [...new Set(datos?.dias_atencion ?? [])],
        apertura: principal?.apertura ?? (datos?.hora_apertura ?? "09:00").slice(0, 5),
        cierre: principal?.cierre ?? (datos?.hora_cierre ?? "18:00").slice(0, 5),
        tiposAnimales: datos?.tipos_animales
          ? [...new Set(datos.tipos_animales.map((t) => TiposMascota.normalizar(t)))]
          : [...new Set(TiposMascota.TODOS)],
        duraciones: datos?.duraciones ?? {},
        sedes,
      },
    );
  }

  private vencio(a: AccesoDto, hoy: LocalDate): boolean {
    return Fechas.iso(a.vence_el)?.isBefore(hoy) === true;
  }

  /**
   * Arma las listas de veterinarios y de solicitudes a partir de los accesos del servidor:
   * quien pidió acceso y todavía no fue aceptado aparece como solicitud; quien tiene al menos un acceso
   * activo o pendiente (iniciado por el dueño) como veterinario autorizado; el resto, como disponible.
   */
  private reconstruirVeterinarios(e: EstadoDueno): void {
    const nombrePorMascota = new Map(e.mascotas.map((m) => [m.id, m.nombre]));
    const accesos = e.accesos.filter((a) => nombrePorMascota.has(a.mascota_id));
    e.autorizados.length = 0;
    e.disponibles.length = 0;
    e.solicitudes.length = 0;

    const porVeterinario = new Map<string, AccesoDto[]>();
    for (const a of accesos) {
      const lista = porVeterinario.get(a.veterinario_id);
      if (lista) lista.push(a);
      else porVeterinario.set(a.veterinario_id, [a]);
    }
    for (const [vetId, lista] of porVeterinario) {
      const candidato = e.veterinarios.get(vetId);
      const perfilVet = candidato && atiendeComoVeterinario(candidato) ? candidato : null;
      if (!perfilVet) continue;
      for (const a of lista.filter((x) => x.estado === "pendiente" && x.iniciado_por === "veterinario")) {
        const propuesta = a.turno_propuesto ?? null;
        let turno: string | null = null;
        if (propuesta) {
          const fecha = fechaDeTexto(contenido(propuesta["fecha"]));
          const hora = contenido(propuesta["hora"])?.slice(0, 5) ?? null;
          const servicio = vacioONull(contenido(propuesta["categoria"]));
          if (fecha) {
            turno =
              " para un turno" + (servicio != null ? ` de ${servicio}` : "") +
              ` el ${Fechas.corta(fecha)}` + (hora != null ? ` a las ${hora} hs` : "");
          }
        }
        e.solicitudes.push(
          new SolicitudItem(
            a.id, perfilVet.nombre, `Solicita acceso a ${nombrePorMascota.get(a.mascota_id)}` + (turno ?? ""),
            Fechas.haceTexto(a.created_at), { fotoPath: perfilVet.foto_path ?? null },
          ),
        );
      }
      const propios = lista.filter((x) => !(x.estado === "pendiente" && x.iniciado_por === "veterinario"));
      if (propios.length === 0) continue;
      // Un permiso activo con la fecha pasada ya no vale: el servidor tampoco lo deja ver
      const hoy = LocalDate.now();
      const vigentes = propios.filter((x) => x.estado === "activo" && !this.vencio(x, hoy));
      const vencidos = propios.filter((x) => x.estado === "activo" && this.vencio(x, hoy));
      const estadoAcceso: EstadoAcceso =
        vigentes.length > 0 ? "ACTIVO" : propios.some((x) => x.estado === "pendiente") ? "PENDIENTE" : "INACTIVO";
      const conAcceso: string[] = [];
      for (const x of [...vigentes, ...propios.filter((y) => y.estado === "pendiente")]) {
        const nombre = nombrePorMascota.get(x.mascota_id);
        if (nombre !== undefined) conAcceso.push(nombre);
      }
      const vet = this.aVeterinario(perfilVet, estadoAcceso, conAcceso);
      const fechasVigentes = vigentes.map((x) => Fechas.iso(x.vence_el)).filter((x): x is LocalDate => x !== null);
      vet.venceEl = fechasVigentes.reduce<LocalDate | null>((m, x) => (m === null || x.isBefore(m) ? x : m), null);
      if (vigentes.length === 0 && vencidos.length > 0) {
        vet.vencido = true;
        const fechasVencidas = vencidos.map((x) => Fechas.iso(x.vence_el)).filter((x): x is LocalDate => x !== null);
        vet.venceEl = fechasVencidas.reduce<LocalDate | null>((m, x) => (m === null || x.isAfter(m) ? x : m), null);
      }
      e.autorizados.push(vet);
    }
    for (const p of e.veterinarios.values()) {
      if (!porVeterinario.has(p.id) && atiendeComoVeterinario(p)) {
        e.disponibles.push(this.aVeterinario(p, "DISPONIBLE", []));
      }
    }
  }

  // ---------- Perfil ----------

  /** Guarda los datos editables del perfil (el correo es el de la cuenta y no se cambia desde acá). */
  guardarPerfil(nombre: string, telefono: string, direccion: string): void {
    const p = this.perfil;
    p.nombre = nombre;
    p.telefono = telefono;
    p.direccion = direccion;
    void Servicios.escribir({ alFallar: this.recargarSiFalla }, async () => {
      await Servicios.fuente.actualizarPerfil({
        nombre,
        telefono: vacioONull(telefono),
        direccion: vacioONull(direccion),
      });
    });
  }

  /** Guarda cómo se acomoda la foto dentro del círculo del perfil. */
  guardarAjusteFoto(): void {
    const p = this.perfil;
    void Servicios.escribir(async () => {
      await Servicios.fuente.actualizarPerfil({
        foto_ajuste: { ajuste: p.ajusteFoto, x: p.desplazamientoFotoX, y: p.desplazamientoFotoY },
      });
    });
  }

  /** Sube la foto de perfil elegida y la guarda en el perfil. */
  cambiarFotoPerfil(uri: string): void {
    const p = this.perfil;
    const anterior = p.fotoPath;
    p.fotoUri = uri;
    void Servicios.escribir(async () => {
      const usuario = CuentaActual.usuarioId;
      if (!usuario) return;
      const ruta = await Imagenes.subirFoto(await Imagenes.prepararFoto(uri), usuario);
      await Servicios.fuente.actualizarPerfil({
        foto_path: ruta,
        foto_ajuste: { ajuste: p.ajusteFoto, x: p.desplazamientoFotoX, y: p.desplazamientoFotoY },
      });
      p.fotoPath = ruta;
      await Imagenes.borrarFoto(anterior);
    });
  }

  // ---------- Mascotas ----------

  buscarMascota(nombre: string | null | undefined): Mascota | null {
    return this.mascotas.find((m) => m.nombre === nombre) ?? null;
  }

  agregarMascota(mascota: Mascota): void {
    this.mascotas.push(mascota);
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      const usuario = CuentaActual.usuarioId;
      if (!usuario) throw new Error("No hay una sesión iniciada");
      const ruta = mascota.fotoUri != null ? await Imagenes.subirFoto(await Imagenes.prepararFoto(mascota.fotoUri), usuario) : null;
      mascota.fotoPath = ruta ?? mascota.fotoPath;
      await Servicios.fuente.crearMascota({
        id: mascota.id,
        dueno_id: usuario,
        nombre: mascota.nombre,
        tipo: mascota.tipo,
        raza: vacioONull(mascota.raza),
        nacimiento: mascota.nacimiento?.toString() ?? null,
        sexo: mascota.sexo?.toLowerCase() ?? null,
        peso_kg: pesoDeTexto(mascota.peso),
        microchip: mascota.microchip !== SIN_DATOS ? mascota.microchip : null,
        color: mascota.color !== SIN_DATOS ? mascota.color : null,
        observaciones: mascota.observaciones !== "Sin observaciones" ? mascota.observaciones : null,
        foto_path: ruta,
      });
    });
  }

  /** El peso se escribe en kilos ("12", "3,5" o "12 kg") y tiene que ser mayor que cero. */
  pesoValido(texto: string): boolean {
    return (pesoDeTexto(texto) ?? 0) > 0;
  }

  /** Guarda los datos editados de una mascota. */
  guardarMascota(m: Mascota): void {
    for (const e of this.eventos) if (e.mascotaId === m.id) e.mascota = m.nombre;
    void Servicios.escribir({ alFallar: this.recargarSiFalla }, async () => {
      await Servicios.fuente.actualizarMascota(m.id, {
        nombre: m.nombre,
        raza: vacioONull(m.raza),
        nacimiento: m.nacimiento?.toString() ?? null,
        sexo: m.sexo?.toLowerCase() ?? null,
        peso_kg: pesoDeTexto(m.peso),
        microchip: m.microchip !== SIN_DATOS ? m.microchip : null,
        color: m.color !== SIN_DATOS ? m.color : null,
        observaciones: m.observaciones !== "Sin observaciones" ? m.observaciones : null,
      });
    });
  }

  cambiarFotoMascota(m: Mascota, uri: string): void {
    const anterior = m.fotoPath;
    m.fotoUri = uri;
    void Servicios.escribir(async () => {
      const usuario = CuentaActual.usuarioId;
      if (!usuario) return;
      const ruta = await Imagenes.subirFoto(await Imagenes.prepararFoto(uri), usuario);
      await Servicios.fuente.actualizarMascota(m.id, { foto_path: ruta });
      m.fotoPath = ruta;
      await Imagenes.borrarFoto(anterior);
    });
  }

  /** Las mascotas con las que se puede sacar turno: las inactivas y las fallecidas quedan en el historial. */
  get mascotasActivas(): Mascota[] {
    return this.mascotas.filter((m) => m.estado === "ACTIVA");
  }

  /**
   * Pasa la mascota a otro estado. Si deja de estar activa se cancelan los turnos que le quedaban pendientes
   * (los ya completados se conservan en su historial).
   */
  cambiarEstadoMascota(mascota: Mascota, nuevo: EstadoMascota): void {
    if (mascota.estado === nuevo) return;
    mascota.estado = nuevo;
    const pendientes =
      nuevo === "ACTIVA" ? [] : this.eventos.filter((e) => e.mascotaId === mascota.id && e.estado === "PENDIENTE");
    quitarSi(this.eventos, (e) => pendientes.includes(e));
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      for (const e of pendientes) await Servicios.fuente.actualizarTurno(e.id, { estado: "cancelado" });
      await Servicios.fuente.actualizarMascota(mascota.id, { estado: EstadosMascota[nuevo].clave });
    });
  }

  /** [motivo] es por qué se da de baja (fallecimiento, adopción u otro) y queda guardado. */
  darDeBajaMascota(mascota: Mascota, motivo: string | null = null): void {
    quitar(this.mascotas, mascota);
    // Los turnos que le quedaban se cancelan para que no queden colgados en la agenda del veterinario
    const turnos = this.eventos.filter((e) => e.mascotaId === mascota.id).map((e) => e.id);
    quitarSi(this.eventos, (e) => e.mascotaId === mascota.id);
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      for (const id of turnos) await Servicios.fuente.actualizarTurno(id, { estado: "cancelado" });
      await Servicios.fuente.actualizarMascota(mascota.id, {
        activa: false,
        motivo_baja: vacioONull(motivo),
      });
      await Imagenes.borrarFoto(mascota.fotoPath);
    });
  }

  // ---------- Tomas de medicación ----------

  /** Las tomas de [dia] de las recetas en curso de las mascotas activas, por hora. */
  tomasDelDia(dia: LocalDate = LocalDate.now()): TomaDelDia[] {
    const dadas = new Set(this.estado.tomas.map((t) => `${t.prescripcion_id}|${t.programada.replace(" ", "T").slice(0, 19)}`));
    const lista: TomaDelDia[] = [];
    for (const dto of this.estado.recetas) {
      const mascota = this.mascotas.find((m) => m.id === dto.mascota_id && m.estado === "ACTIVA");
      if (!mascota) continue;
      const receta = prescripcionDeDto(dto);
      for (const momento of tomasDeLaReceta(receta, dia)) {
        const clave = claveDeToma(momento);
        lista.push({ clave, receta, mascota, momento, dada: dadas.has(`${receta.id}|${clave}`) });
      }
    }
    return lista.sort((a, b) => a.momento.compareTo(b.momento) || a.mascota.nombre.localeCompare(b.mascota.nombre));
  }

  /** Tilda (o destilda) una toma: se ve al instante y se guarda en segundo plano. */
  marcarToma(toma: TomaDelDia, dada: boolean): void {
    const e = this.estado;
    const esta = (t: TomaDto) => t.prescripcion_id === toma.receta.id && t.programada.replace(" ", "T").slice(0, 19) === toma.clave;
    if (dada && !e.tomas.some(esta)) {
      e.tomas.push({
        id: `local-${toma.receta.id}-${toma.clave}`, prescripcion_id: toma.receta.id, mascota_id: toma.mascota.id,
        programada: toma.clave, dada_at: new Date().toISOString(), registrada_por: CuentaActual.usuarioId,
      });
    } else if (!dada) {
      quitarSi(e.tomas, esta);
    }
    void Servicios.escribir({ alFallar: this.recargarSiFalla }, async () => {
      if (dada) await Servicios.fuente.registrarToma(toma.receta.id, toma.clave);
      else await Servicios.fuente.quitarToma(toma.receta.id, toma.clave);
    });
  }

  // ---------- Co-dueños ----------

  /** Invita a otra cuenta, por DNI o correo, a ser co-dueña de [mascota]. Devuelve el nombre de quien recibe la invitación. */
  async invitarCodueno(mascota: Mascota, dniOCorreo: string): Promise<string> {
    return Servicios.fuente.invitarCodueno(mascota.id, dniOCorreo.trim());
  }

  /** Dueños de la mascota (el original primero) e invitaciones que todavía no se respondieron. */
  async duenosDe(mascota: Mascota): Promise<DuenoMascotaDto[]> {
    return Servicios.fuente.duenosDeMascota(mascota.id);
  }

  /** El dueño original quita a un co-dueño, o quien invitó cancela una invitación pendiente. */
  async quitarCodueno(coduenoId: string): Promise<void> {
    await Servicios.fuente.quitarCodueno(coduenoId);
  }

  /** La cuenta deja de ser co-dueña de [mascota]: deja de verla. */
  async dejarDeSerDueno(mascota: Mascota, coduenoId: string): Promise<void> {
    await Servicios.fuente.quitarCodueno(coduenoId);
    quitar(this.mascotas, mascota);
    quitarSi(this.eventos, (e) => e.mascotaId === mascota.id);
    Servicios.avisarCambio();
  }

  /** Acepta o rechaza una invitación; al aceptar se vuelve a pedir todo para traer la mascota con su historial. */
  async responderInvitacion(invitacion: InvitacionCoduenoDto, aceptar: boolean): Promise<void> {
    await Servicios.fuente.responderInvitacionCodueno(invitacion.id, aceptar);
    quitarSi(this.estado.invitaciones, (i) => i.id === invitacion.id);
    if (aceptar) await this.recargarTodo();
    else Servicios.avisarCambio();
  }

  /** Estado de salud que se muestra en las tarjetas: hay una vacuna agendada en los próximos 30 días. */
  tieneVacunaPendiente(mascota: string): boolean {
    const hoy = LocalDate.now();
    const limite = hoy.plusDays(30);
    return this.eventos.some(
      (e) => vigente(e, hoy) && !e.fecha.isAfter(limite) && iguales(e.mascota, mascota) &&
        e.categoria.toLowerCase().includes("vacuna"),
    );
  }

  // ---------- Eventos ----------

  eventosDelDia(fecha: LocalDate): EventoMascota[] {
    return this.eventos.filter((e) => e.fecha.equals(fecha)).sort((a, b) => comparar(a.hora, b.hora));
  }

  cantidadDelMes(mes: YearMonth): number {
    return this.eventos.filter((e) => e.fecha.yearMonth().equals(mes)).length;
  }

  /** Eventos próximos o ya realizados, del más cercano al más lejano; opcionalmente de una sola mascota. */
  eventosOrdenados(proximos: boolean, mascota: string | null = null): EventoMascota[] {
    const hoy = LocalDate.now();
    const lista = this.eventos
      .filter((e) => vigente(e, hoy) === proximos)
      .filter((e) => mascota == null || iguales(e.mascota, mascota))
      .sort(porFechaYHora);
    return proximos ? lista : lista.reverse();
  }

  actividadReciente(): EventoMascota[] {
    const hoy = LocalDate.now();
    const desde = hoy.minusDays(30);
    return this.eventos
      .filter((e) => (e.estado === "COMPLETADO" || !e.fecha.isAfter(hoy)) && !e.fecha.isBefore(desde))
      .sort(porFechaYHora)
      .reverse();
  }

  proximoEvento(mascota: string): EventoMascota | null {
    const hoy = LocalDate.now();
    let minimo: EventoMascota | null = null;
    for (const e of this.eventos) {
      if (!(vigente(e, hoy) && iguales(e.mascota, mascota))) continue;
      if (minimo === null || porFechaYHora(minimo, e) > 0) minimo = e;
    }
    return minimo;
  }

  /** Un turno se puede editar o cancelar solo si es próximo: no está completado y todavía no llegó su hora. */
  esEditable(evento: EventoMascota): boolean {
    return (
      evento.estado !== "COMPLETADO" && evento.estado !== "CANCELADO" &&
      !evento.fecha.isBefore(LocalDate.now()) && !this.horaPasada(evento.fecha, evento.hora)
    );
  }

  /** Los turnos próximos que se pueden editar, del más cercano al más lejano; opcionalmente de una sola mascota. */
  eventosEditables(mascota: string | null = null): EventoMascota[] {
    return this.eventos
      .filter((e) => this.esEditable(e) && (mascota == null || iguales(e.mascota, mascota)))
      .sort(porFechaYHora);
  }

  eventosDeMascota(nombre: string | null | undefined): EventoMascota[] {
    return this.eventos.filter((e) => nombre == null || e.mascota === nombre);
  }

  horaPasada(fecha: LocalDate, hora: string): boolean {
    if (!fecha.equals(LocalDate.now())) return false;
    const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hora);
    if (!m) return false;
    const h = Number(m[1]);
    const min = Number(m[2]);
    const s = m[3] !== undefined ? Number(m[3]) : 0;
    if (h > 23 || min > 59 || s > 59) return false;
    const ahora = Reloj.ahora();
    const ahoraSeg =
      ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds() + ahora.getMilliseconds() / 1000;
    return h * 3600 + min * 60 + s < ahoraSeg;
  }

  /**
   * Veterinarios que ofrecen el servicio o la especialidad elegida y atienden ese tipo de mascota. Sin
   * servicio (null) se ofrecen todos; sin tipo de mascota (null) no se filtra por animal.
   */
  veterinariosPara(servicio: string | null, tipoMascota: string | null = null): VeterinarioAcceso[] {
    let lista = this.todosLosVeterinarios();
    if (servicio != null) {
      lista = lista.filter((vet) => vet.especialidades.some((e) => iguales(e, servicio)));
    }
    if (tipoMascota != null) lista = lista.filter((vet) => vet.atiende(tipoMascota));
    return lista;
  }

  /** True si atiende ese día en [sede] (o, sin indicarla, en su lugar principal). */
  trabajaEl(vet: VeterinarioAcceso, fecha: LocalDate, sede: SedeVet | null = vet.sede(null)): boolean {
    return (sede?.dias ?? vet.diasAtencion).includes(fecha.dayOfWeek);
  }

  /** True si atiende ese día en alguno de sus lugares. */
  trabajaEnAlgunLugar(vet: VeterinarioAcceso, fecha: LocalDate): boolean {
    const lugares: (SedeVet | null)[] = vet.sedes.length === 0 ? [null] : vet.sedes;
    return lugares.some((s) => this.trabajaEl(vet, fecha, s));
  }

  private minutos(hora: string): number {
    const i = hora.indexOf(":");
    const antes = i < 0 ? hora : hora.slice(0, i);
    const despues = i < 0 ? hora : hora.slice(i + 1);
    return entero(antes) * 60 + entero(despues);
  }

  /** "10:00" + 90 min = "11:30". */
  horaFin(hora: string, duracionMin: number): string {
    const fin = this.minutos(hora) + duracionMin;
    return `${dos(Math.trunc(fin / 60) % 24)}:${dos(fin % 60)}`;
  }

  /**
   * Horarios de inicio ("HH:mm") que el veterinario ofrece ese día, uno cada [PASO_HORARIOS_MIN] minutos, para
   * un turno que dura [duracionMin]: solo los que terminan antes de que cierre.
   */
  horasDe(
    vet: VeterinarioAcceso, fecha: LocalDate, duracionMin: number = CatalogoMedico.DURACION_GENERAL_MIN,
    sede: SedeVet | null = vet.sede(null),
  ): string[] {
    if (!this.trabajaEl(vet, fecha, sede)) return [];
    const horas: string[] = [];
    let t = this.minutos(sede?.apertura ?? vet.apertura);
    const fin = this.minutos(sede?.cierre ?? vet.cierre);
    while (t + duracionMin <= fin) {
      horas.push(`${dos(Math.trunc(t / 60))}:${dos(t % 60)}`);
      t += this.PASO_HORARIOS_MIN;
    }
    return horas;
  }

  /** True si dos turnos que arrancan a [horaA] y [horaB] se pisan, según lo que dura cada uno. */
  seSuperponen(horaA: string, duracionA: number, horaB: string, duracionB: number): boolean {
    const a = this.minutos(horaA);
    const b = this.minutos(horaB);
    return a < b + duracionB && b < a + duracionA;
  }

  /** True si un turno de [duracionMin] que arranca a [hora] pisa alguno de los turnos [ocupados]. */
  estaOcupado(hora: string, duracionMin: number, ocupados: HoraOcupadaDto[]): boolean {
    return ocupados.some((o) => this.seSuperponen(hora, duracionMin, o.hora, o.duracion_min));
  }

  /** Turnos que ya tiene el veterinario ese día (hora y duración; la lista de turnos ajenos no es visible). */
  async horasOcupadas(vet: VeterinarioAcceso, fecha: LocalDate): Promise<HoraOcupadaDto[]> {
    return Servicios.fuente.horariosOcupados(vet.id, fecha.toString());
  }

  /**
   * True si la mascota ya tiene otro turno que se pisa con este. [ignorar] es el turno que se está editando:
   * no choca consigo mismo.
   */
  hayConflictoDeTurno(
    fecha: LocalDate, hora: string, mascota: string | null, ignorar: EventoMascota | null = null,
    duracionMin: number = CatalogoMedico.DURACION_GENERAL_MIN,
  ): boolean {
    return (
      mascota != null &&
      this.eventos.some(
        (e) =>
          (ignorar == null || (e !== ignorar && e.id !== ignorar.id)) && e.fecha.equals(fecha) &&
          e.estado === "PENDIENTE" && iguales(e.mascota, mascota) &&
          this.seSuperponen(hora, duracionMin, e.hora, e.duracionMin),
      )
    );
  }

  /** Documentos y archivos que ya tiene cargados la mascota, para elegir uno al sacar un turno. */
  async estudiosDisponibles(mascota: Mascota): Promise<EstudioAdjunto[]> {
    const f = Servicios.fuente;
    const [registros, archivos] = await Promise.all([
      oVacia(() => f.registrosSalud()),
      oVacia(() => f.archivosDe(mascota.id)),
    ]);
    const deCarnet = registros
      .filter((r) => r.mascota_id === mascota.id && r.tipo === "documento" && vacioONull(r.archivo_path) !== null)
      .map((r) => {
        const ruta = r.archivo_path as string;
        const punto = ruta.lastIndexOf(".");
        return new EstudioAdjunto(r.titulo, punto < 0 ? "pdf" : ruta.slice(punto + 1), ruta);
      });
    const sueltos = archivos.map((a) => new EstudioAdjunto(a.nombre, a.extension, a.storage_path));
    const vistos = new Set<string>();
    const resultado: EstudioAdjunto[] = [];
    for (const x of [...deCarnet, ...sueltos]) {
      if (vistos.has(x.ruta)) continue;
      vistos.add(x.ruta);
      resultado.push(x);
    }
    return resultado;
  }

  /** Sube un estudio nuevo a la ficha de la mascota y devuelve el adjunto listo para el turno. */
  async subirEstudio(
    mascota: Mascota, tipo: string, nombre: string, extension: string, bytes: Uint8Array, tipoMime: string,
  ): Promise<EstudioAdjunto> {
    // En la ficha queda con el tipo adelante ("Radiografía - tórax") para encontrarlo fácil en Documentos
    const punto = nombre.lastIndexOf(".");
    const nombreVisible = `${tipo} - ${punto < 0 ? nombre : nombre.slice(0, punto)}`;
    const item = await ArchivosRepo.agregar(mascota.id, nombreVisible, extension, bytes, tipoMime);
    return new EstudioAdjunto(item.nombre, item.tipoExtension.toLowerCase(), item.storagePath, tipo);
  }

  /** Agenda el turno. El servidor valida el horario del veterinario y le da acceso a la mascota. */
  agendarEvento(
    fecha: LocalDate, categoria: string, mascota: string, veterinario: string, hora: string, observaciones: string,
    estudios: EstudioAdjunto[] = [], sedeId: string | null = null,
  ): void {
    const m = this.buscarMascota(mascota);
    if (!m) return;
    const vet = this.buscarVeterinario(veterinario);
    const sedeElegida = vet?.sede(sedeId) ?? null;
    const sede = sedeElegida && sedeElegida.id.trim() !== "" ? sedeElegida : null;
    const evento = new EventoMascota(categoria, mascota, veterinario, hora, observaciones, fecha, {
      mascotaId: m.id,
      veterinarioId: vet ? vacioONull(vet.id) : null,
      sedeId: sede?.id ?? null,
    });
    this.eventos.push(evento);
    if (vet && veterinario.length > 0) this.autorizarPorTurno(veterinario, mascota, true);
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      const usuario = CuentaActual.usuarioId;
      if (!usuario) throw new Error("No hay una sesión iniciada");
      await Servicios.fuente.crearTurno({
        id: evento.id,
        mascota_id: m.id,
        veterinario_id: evento.veterinarioId,
        categoria,
        fecha: fecha.toString(),
        hora: `${hora}:00`,
        notas: vacioONull(observaciones),
        creado_por: usuario,
        sede_id: evento.sedeId,
      });
      // Los estudios se enlazan después de crear el turno, que es de lo que dependen
      if (estudios.length > 0) {
        await Servicios.fuente.adjuntarEstudios(
          estudios.map((x) => ({
            turno_id: evento.id,
            storage_path: x.ruta,
            nombre: x.nombre,
            extension: x.extension,
            tipo: x.tipo,
            adjuntado_por: usuario,
          })),
        );
      }
    });
  }

  cancelarEvento(evento: EventoMascota): void {
    quitar(this.eventos, evento);
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      await Servicios.fuente.actualizarTurno(evento.id, { estado: "cancelado" });
    });
  }

  modificarEvento(
    evento: EventoMascota, fecha: LocalDate, hora: string, veterinario: string, observaciones: string,
    sedeId: string | null = evento.sedeId,
  ): void {
    const vet = this.buscarVeterinario(veterinario);
    evento.fecha = fecha;
    evento.hora = hora;
    evento.veterinario = veterinario;
    evento.veterinarioId = vet ? vacioONull(vet.id) : null;
    const sede = vet?.sede(sedeId) ?? null;
    evento.sedeId = sede && sede.id.trim() !== "" ? sede.id : null;
    evento.observaciones = observaciones;
    if (veterinario.length > 0) this.autorizarPorTurno(veterinario, evento.mascota, true);
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      await Servicios.fuente.actualizarTurno(evento.id, {
        fecha: fecha.toString(),
        hora: `${hora}:00`,
        veterinario_id: evento.veterinarioId,
        sede_id: evento.sedeId,
        notas: vacioONull(observaciones),
      });
    });
  }

  // ---------- Veterinarios y accesos ----------

  todosLosVeterinarios(): VeterinarioAcceso[] {
    return [...this.autorizados, ...this.disponibles];
  }

  /** El lugar donde es [evento], si se sabe cuál. */
  sedeDe(evento: EventoMascota): SedeVet | null {
    const vet = this.buscarVeterinario(evento.veterinario);
    if (!vet) return null;
    const porId = evento.sedeId != null ? vet.sedes.find((s) => s.id === evento.sedeId) : undefined;
    return porId ?? vet.sede(null);
  }

  buscarVeterinario(nombre: string | null | undefined): VeterinarioAcceso | null {
    if (nombre == null || nombre.trim() === "") return null;
    return this.todosLosVeterinarios().find((v) => iguales(v.nombre, nombre.trim())) ?? null;
  }

  tieneTurnoCon(veterinario: string, mascota: string): boolean {
    return this.eventos.some((e) => iguales(e.veterinario, veterinario) && iguales(e.mascota, mascota));
  }

  /**
   * Tener un turno con el veterinario alcanza para que vea la ficha de la mascota: el servidor crea el acceso
   * al agendar. Acá solo se refleja en pantalla. Devuelve true si el veterinario pasó a tener acceso ahora.
   */
  autorizarPorTurno(nombreVet: string, mascota: string, reactivar: boolean): boolean {
    const vet = this.buscarVeterinario(nombreVet);
    if (!vet) return false;
    if (vet.estado === "INACTIVO" && !reactivar) return false;
    const teniaAcceso = vet.estado === "ACTIVO" && vet.mascotas.has(mascota);
    quitar(this.disponibles, vet);
    if (!this.autorizados.includes(vet)) this.autorizados.push(vet);
    vet.estado = "ACTIVO";
    vet.mascotas.add(mascota);
    return !teniaAcceso;
  }

  turnosDeVeterinario(vet: VeterinarioAcceso): number {
    return this.eventos.filter((e) => iguales(e.veterinario, vet.nombre)).length;
  }

  proximoTurnoDeVeterinario(vet: VeterinarioAcceso): EventoMascota | null {
    const hoy = LocalDate.now();
    let minimo: EventoMascota | null = null;
    for (const e of this.eventos) {
      if (!(vigente(e, hoy) && iguales(e.veterinario, vet.nombre))) continue;
      if (minimo === null || minimo.fecha.compareTo(e.fecha) > 0) minimo = e;
    }
    return minimo;
  }

  revocarAcceso(vet: VeterinarioAcceso): void {
    vet.estado = "INACTIVO";
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      await Servicios.fuente.actualizarAccesosDeVeterinario(vet.id, "inactivo");
    });
  }

  /** Vuelve a dar acceso; [venceEl] es el último día del permiso (null = sin vencimiento). */
  restablecerAcceso(vet: VeterinarioAcceso, venceEl: LocalDate | null = null): void {
    vet.estado = "ACTIVO";
    vet.vencido = false;
    vet.venceEl = venceEl;
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      await Servicios.fuente.actualizarAccesosDeVeterinario(vet.id, "activo");
      await Servicios.fuente.fijarVencimientoDeAccesos(vet.id, venceEl?.toString() ?? null);
    });
  }

  /** Cambia hasta cuándo sirve el permiso de un veterinario que ya tiene acceso. */
  cambiarVencimiento(vet: VeterinarioAcceso, venceEl: LocalDate | null): void {
    vet.venceEl = venceEl;
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      await Servicios.fuente.fijarVencimientoDeAccesos(vet.id, venceEl?.toString() ?? null);
    });
  }

  /** Quién autorizó, pidió o sacó cada permiso y cuándo (lo más nuevo primero). */
  async historialDePermisos(): Promise<EntradaPermiso[]> {
    const e = this.estado;
    const yo = CuentaActual.usuarioId;
    const mascotas = new Map(e.mascotas.map((m) => [m.id, m.nombre]));
    const historial = await Servicios.fuente.historialDeAccesos();
    return historial
      .filter((h) => mascotas.has(h.mascota_id))
      .map((h) => ({
        cuando: Fechas.instante(h.created_at),
        evento: h.evento,
        veterinario: e.veterinarios.get(h.veterinario_id)?.nombre ?? "Veterinario",
        mascota: mascotas.get(h.mascota_id) ?? "",
        actor:
          h.actor_id == null ? "El sistema" : h.actor_id === yo ? "Vos" : e.veterinarios.get(h.actor_id)?.nombre ?? "Otra persona",
        venceEl: Fechas.iso(h.vence_el),
      }));
  }

  /** Autoriza a un veterinario del catálogo para que vea todas las mascotas actuales. */
  autorizarVeterinario(candidato: VeterinarioAcceso, venceEl: LocalDate | null = null): void {
    const existente = this.autorizados.find((v) => v.id === candidato.id);
    candidato.venceEl = venceEl;
    if (existente) {
      existente.estado = "ACTIVO";
      existente.vencido = false;
      existente.venceEl = venceEl;
    } else {
      quitar(this.disponibles, candidato);
      candidato.estado = "ACTIVO";
      for (const m of this.mascotas) candidato.mascotas.add(m.nombre);
      this.autorizados.push(candidato);
    }
    const ids = this.mascotas.map((m) => m.id);
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      await Servicios.fuente.compartirMascotas(ids, candidato.id, venceEl?.toString() ?? null);
    });
  }

  /** Veterinarios que todavía se pueden autorizar. */
  candidatosAAutorizar(consulta: string): VeterinarioAcceso[] {
    const q = consulta.trim().toLowerCase();
    return this.disponibles.filter((vet) => {
      const yaAutorizado = this.autorizados.some((a) => a.id === vet.id && a.estado !== "INACTIVO");
      return (
        !yaAutorizado &&
        (q === "" || [vet.nombre, vet.usuario, vet.email, vet.matricula].some((t) => t.toLowerCase().includes(q)))
      );
    });
  }

  // ---------- Solicitudes de acceso ----------

  /** El dueño acepta o rechaza el pedido de un veterinario para ver una mascota. */
  resolverSolicitud(item: SolicitudItem, aceptar: boolean): void {
    item.estado = aceptar ? "ACEPTADA" : "RECHAZADA";
    void Servicios.escribir({ alFallar: this.recargarSiFalla, alTerminar: this.recargarAlTerminar }, async () => {
      await Servicios.fuente.actualizarAcceso(item.id, aceptar ? "activo" : "rechazado");
    });
  }

  /** Perfil de un veterinario del catálogo, con matrícula y datos de la clínica (para firmar la receta). */
  perfilDeVeterinario(id: string | null | undefined): PerfilDto | null {
    return id != null ? this.estado.veterinarios.get(id) ?? null : null;
  }

  /**
   * Arma el detalle de un turno para el dueño, que puede leerlo pero no editarlo. Los archivos son los que el
   * veterinario adjuntó al informe de ese turno; los registros de salud se asocian por veterinario y día.
   */
  async detalleDelTurno(evento: EventoMascota): Promise<DetalleTurno> {
    const f = Servicios.fuente;
    const [informes, registros, archivos, estudios, recetas] = await Promise.all([
      f.informesDe(evento.mascotaId),
      f.registrosSalud(),
      f.archivosDe(evento.mascotaId),
      oVacia(() => f.estudiosDeTurno(evento.id)),
      oVacia(() => f.prescripciones(evento.mascotaId)),
    ]);

    const informe = informes.find((i) => i.turno_id === evento.id);
    const vet = evento.veterinarioId;
    const dia = evento.fecha.toString();
    const delTurno = registros
      .filter((r) => r.mascota_id === evento.mascotaId && r.fecha === dia && (vet == null || r.creado_por === vet))
      .map((r) => {
        const tipo = r.tipo === "vacuna" ? "Vacuna" : r.tipo === "tratamiento" ? "Tratamiento" : "Documento";
        return `${tipo}: ${r.titulo}`;
      });
    // Los archivos de la consulta son los que adjuntó el veterinario al informe, no los que subió el dueño
    const adjuntos = archivos
      .filter((a) => a.turno_id === evento.id && (vet == null || a.subido_por === vet))
      .map((a) => new ArchivoDeTurno(this.nombreConExtension(a.nombre, a.extension), a.extension, a.storage_path));
    return new DetalleTurno({
      motivo: informe?.motivo ?? "",
      diagnostico: informe?.diagnostico ?? "",
      tratamiento: informe?.tratamiento ?? "",
      registros: delTurno,
      archivos: adjuntos,
      estudios: estudios.map((x) => new ArchivoDeTurno(x.nombre, x.extension, x.storage_path, x.tipo)),
      anamnesis: informe?.anamnesis ?? "",
      examenFisico: informe?.examen_fisico ?? "",
      signos: {
        pesoKg: informe?.peso_kg ?? null,
        temperaturaC: informe?.temperatura_c ?? null,
        frecuenciaCardiaca: informe?.frecuencia_cardiaca ?? null,
        frecuenciaRespiratoria: informe?.frecuencia_respiratoria ?? null,
      },
      receta: recetas.filter((p) => p.turno_id === evento.id).map(prescripcionDeDto),
    });
  }

  private nombreConExtension(nombre: string, extension: string): string {
    return nombre.toLowerCase().endsWith(`.${extension}`.toLowerCase()) ? nombre : `${nombre}.${extension}`;
  }

  // ---------- Notificaciones ----------

  marcarNotificacionesLeidas(): void {
    if (!this.estado.notificaciones.some((n) => !n.leida)) return;
    for (const n of this.estado.notificaciones) n.leida = true;
    void Servicios.escribir(async () => {
      await Servicios.fuente.marcarNotificacionesLeidas();
    });
  }

  /** Borra una sola notificación: se saca de la lista ya y se borra del servidor en segundo plano. */
  borrarNotificacion(notificacion: NotificacionDueno): void {
    quitar(this.estado.notificaciones, notificacion);
    if (notificacion.id.trim() === "") return;
    void Servicios.escribir(async () => {
      await Servicios.fuente.borrarNotificacion(notificacion.id);
    });
  }

  limpiarNotificaciones(): void {
    this.estado.notificaciones.length = 0;
    void Servicios.escribir(async () => {
      await Servicios.fuente.borrarNotificaciones();
    });
  }
}

export const DuenoRepo = new DuenoRepoImpl();
