import { CatalogoMedico } from "../data/catalogoMedico";
import { Fechas } from "../util/fechas";
import { LocalDate, LocalDateTime, periodoEntre } from "../util/tiempo";
import { nuevoId } from "../util/uuid";
import { TiposMascota } from "./tiposMascota";

export const SIN_DATOS = "Sin datos";

export type Sexo = "Macho" | "Hembra";
export const Sexos: Sexo[] = ["Macho", "Hembra"];
export function sexoDeTexto(texto: string | null | undefined): Sexo | null {
  const t = texto?.trim().toLowerCase();
  return Sexos.find((s) => s.toLowerCase() === t) ?? null;
}

/** En qué situación está una mascota: las inactivas y las fallecidas dejan de agendar turnos pero conservan su historial. */
export type EstadoMascota = "ACTIVA" | "INACTIVA" | "FALLECIDA";
export const EstadosMascota: Record<EstadoMascota, { etiqueta: string; clave: string; descripcion: string }> = {
  ACTIVA: { etiqueta: "Activa", clave: "activa", descripcion: "Se atiende con normalidad y puede sacar turnos." },
  INACTIVA: { etiqueta: "Inactiva", clave: "inactiva", descripcion: "Ya no está con vos o no se atiende: queda en el historial." },
  FALLECIDA: { etiqueta: "Fallecida", clave: "fallecida", descripcion: "Se conserva su historia clínica como recuerdo." },
};
export function estadoMascotaDeClave(clave: string | null | undefined): EstadoMascota {
  return (Object.keys(EstadosMascota) as EstadoMascota[]).find((k) => EstadosMascota[k].clave === clave) ?? "ACTIVA";
}

/** Mascota del dueño con sesión iniciada. */
export class Mascota {
  nombre: string;
  tipo: string;
  raza: string;
  nacimiento: LocalDate | null;
  sexo: Sexo | null;
  /** Foto elegida en este dispositivo; se muestra mientras se sube o hasta que llega la del servidor. */
  fotoUri: string | null;
  /** Ruta de la foto en el bucket `fotos` del servidor. */
  fotoPath: string | null;
  readonly id: string;
  peso: string;
  microchip: string;
  color: string;
  observaciones: string;
  /** Alergias, carácter y condiciones a tener en cuenta; los veterinarios lo ven destacado. */
  alertas: string;
  estado: EstadoMascota;
  /** La cuenta es co-dueña: la mascota es de otra persona que la invitó (no puede eliminarla ni quitar dueños). */
  compartida: boolean;

  constructor(
    nombre: string,
    tipo: string,
    opciones: Partial<Omit<Mascota, "tipoRazaTexto" | "nacimientoSexoTexto" | "tienePesoValido" | "inicial" | "edadTexto">> = {},
  ) {
    this.nombre = nombre;
    this.tipo = tipo;
    this.raza = opciones.raza ?? "";
    this.nacimiento = opciones.nacimiento ?? null;
    this.sexo = opciones.sexo ?? null;
    this.fotoUri = opciones.fotoUri ?? null;
    this.fotoPath = opciones.fotoPath ?? null;
    this.id = opciones.id ?? nuevoId();
    this.peso = opciones.peso ?? SIN_DATOS;
    this.microchip = opciones.microchip ?? SIN_DATOS;
    this.color = opciones.color ?? SIN_DATOS;
    this.observaciones = opciones.observaciones ?? "Sin observaciones";
    this.alertas = opciones.alertas ?? "";
    this.estado = opciones.estado ?? "ACTIVA";
    this.compartida = opciones.compartida ?? false;
  }

  /** "Perro - Golden Retriever", o solo el tipo si no se cargó la raza. */
  get tipoRazaTexto(): string {
    return !this.raza.trim() || this.raza.toLowerCase() === this.tipo.toLowerCase() ? this.tipo : `${this.tipo} - ${this.raza}`;
  }

  /** "Nacido el 15 Mar 2020 - Macho". */
  get nacimientoSexoTexto(): string {
    const nacido = this.nacimiento ? `Nacido el ${Fechas.corta(this.nacimiento)}` : "Fecha de nacimiento sin datos";
    return this.sexo ? `${nacido} - ${this.sexo}` : nacido;
  }

  get tienePesoValido(): boolean {
    return this.peso.trim() !== "" && this.peso.toLowerCase() !== SIN_DATOS.toLowerCase();
  }

  /** "6 años" o "3 meses"; null si no se conoce la fecha de nacimiento. */
  edadTexto(hoy: LocalDate = LocalDate.now()): string | null {
    if (!this.nacimiento) return null;
    const periodo = periodoEntre(this.nacimiento, hoy);
    if (periodo.isNegative) return null;
    if (periodo.years >= 1) return periodo.years === 1 ? "1 año" : `${periodo.years} años`;
    return periodo.months <= 1 ? "1 mes" : `${periodo.months} meses`;
  }

  get inicial(): string {
    return this.nombre.trim().slice(0, 1).toUpperCase() || "?";
  }
}

export type EstadoTurno = "PENDIENTE" | "COMPLETADO" | "CANCELADO";

/** Turno o recordatorio de una mascota. */
export class EventoMascota {
  categoria: string;
  mascota: string;
  veterinario: string;
  hora: string;
  observaciones: string;
  fecha: LocalDate;
  readonly id: string;
  mascotaId: string;
  veterinarioId: string | null;
  estado: EstadoTurno;
  /** Minutos que dura el turno; lo fija el servidor según el servicio y el veterinario. */
  duracionMin: number;
  /** Lugar de atención donde es el turno; null en los que se cargaron sin elegir uno. */
  sedeId: string | null;

  constructor(
    categoria: string,
    mascota: string,
    veterinario: string,
    hora: string,
    observaciones: string,
    fecha: LocalDate,
    opciones: {
      id?: string;
      mascotaId?: string;
      veterinarioId?: string | null;
      estado?: EstadoTurno;
      duracionMin?: number;
      sedeId?: string | null;
    } = {},
  ) {
    this.categoria = categoria;
    this.mascota = mascota;
    this.veterinario = veterinario;
    this.hora = hora;
    this.observaciones = observaciones;
    this.fecha = fecha;
    this.id = opciones.id ?? nuevoId();
    this.mascotaId = opciones.mascotaId ?? "";
    this.veterinarioId = opciones.veterinarioId ?? null;
    this.estado = opciones.estado ?? "PENDIENTE";
    this.duracionMin = opciones.duracionMin ?? CatalogoMedico.DURACION_GENERAL_MIN;
    this.sedeId = opciones.sedeId ?? null;
  }
}

export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Un lugar donde atiende un veterinario, con sus propios días y horarios. */
export interface SedeVet {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string;
  /** Días de atención: 1 = lunes ... 7 = domingo. */
  readonly dias: number[];
  readonly apertura: string;
  readonly cierre: string;
  /** Pausa de todos los días que atiende acá ("13:00"); null si no tiene. */
  readonly pausaDesde: string | null;
  readonly pausaHasta: string | null;
  /** Lo que ofrece en este lugar (servicios y especialidades); null = todo lo que ofrece. */
  readonly servicios: string[] | null;
}

export function crearSede(s: Partial<SedeVet> & { id: string; nombre: string }): SedeVet {
  return {
    id: s.id,
    nombre: s.nombre,
    direccion: s.direccion ?? "",
    dias: s.dias ?? [1, 2, 3, 4, 5],
    apertura: s.apertura ?? "09:00",
    cierre: s.cierre ?? "18:00",
    pausaDesde: s.pausaDesde ?? null,
    pausaHasta: s.pausaHasta ?? null,
    servicios: s.servicios ?? null,
  };
}

/**
 * True si en ese lugar se atiende ese servicio o especialidad. Los tipos generales (Consulta, Control, Vacuna...)
 * y un lugar sin lista propia valen para todo.
 */
export function ofreceEn(sede: SedeVet | null | undefined, servicio: string | null | undefined, delCatalogo: (n: string) => boolean): boolean {
  if (!sede?.servicios || !servicio || !delCatalogo(servicio)) return true;
  const buscado = servicio.trim().toLowerCase();
  return sede.servicios.some((s) => s.trim().toLowerCase() === buscado);
}

/** "Solo: Cirugía 24hs, Tomografía", o "" si en el lugar ofrece todo. */
export function textoServiciosSede(sede: SedeVet): string {
  return sede.servicios && sede.servicios.length > 0 ? `Solo: ${sede.servicios.join(", ")}` : "";
}

/** "Lun a Vie · 09:00 a 18:00 hs", o los días separados por comas si no son consecutivos. */
export function textoHorarioSede(sede: SedeVet): string {
  const ordenados = [...new Set(sede.dias)].sort((a, b) => a - b);
  if (ordenados.length === 0) return "Sin días de atención configurados";
  const consecutivos = ordenados.every((d, i) => i === 0 || d === ordenados[i - 1] + 1);
  const textoDias =
    consecutivos && ordenados.length > 2
      ? `${DIAS_CORTOS[ordenados[0] - 1]} a ${DIAS_CORTOS[ordenados[ordenados.length - 1] - 1]}`
      : ordenados.map((d) => DIAS_CORTOS[d - 1]).join(", ");
  const pausa = sede.pausaDesde && sede.pausaHasta ? ` (pausa de ${sede.pausaDesde} a ${sede.pausaHasta})` : "";
  return `${textoDias} · ${sede.apertura} a ${sede.cierre} hs${pausa}`;
}

/** Nombre y dirección en una línea. */
export function textoLugarSede(sede: SedeVet): string {
  return sede.direccion.trim() ? `${sede.nombre} · ${sede.direccion}` : sede.nombre;
}

export type EstadoAcceso = "ACTIVO" | "INACTIVO" | "PENDIENTE" | "DISPONIBLE";

/** Veterinario tal como lo ve el dueño: si tiene acceso a sus mascotas y a cuáles. */
export class VeterinarioAcceso {
  nombre: string;
  readonly usuario: string;
  email: string;
  matricula: string;
  readonly especialidad: string;
  estado: EstadoAcceso;
  readonly mascotas: Set<string>;
  readonly id: string;
  fotoPath: string | null;
  /** Todas las especialidades que cargó el veterinario. */
  readonly especialidades: string[];
  /** Días de atención: 1 = lunes ... 7 = domingo. */
  readonly diasAtencion: number[];
  readonly apertura: string;
  readonly cierre: string;
  /** Tipos de mascota que atiende, con los nombres de [TiposMascota]. */
  readonly tiposAnimales: string[];
  /** Minutos que dura cada servicio para este veterinario; lo que falta usa la duración por defecto. */
  readonly duraciones: Record<string, number>;
  /** Lugares donde atiende, el principal primero. */
  readonly sedes: SedeVet[];
  /** Último día del permiso; null si no vence. */
  venceEl: LocalDate | null = null;
  /** True si el permiso existía pero ya venció (el veterinario dejó de ver las fichas). */
  vencido = false;

  constructor(
    nombre: string,
    usuario: string,
    email: string,
    matricula: string,
    especialidad: string,
    estado: EstadoAcceso,
    mascotas: Iterable<string> = [],
    opciones: {
      id?: string;
      fotoPath?: string | null;
      especialidades?: string[];
      diasAtencion?: number[];
      apertura?: string;
      cierre?: string;
      tiposAnimales?: string[];
      duraciones?: Record<string, number>;
      sedes?: SedeVet[];
    } = {},
  ) {
    this.nombre = nombre;
    this.usuario = usuario;
    this.email = email;
    this.matricula = matricula;
    this.especialidad = especialidad;
    this.estado = estado;
    this.mascotas = new Set(mascotas);
    this.id = opciones.id ?? "";
    this.fotoPath = opciones.fotoPath ?? null;
    this.especialidades = opciones.especialidades ?? [];
    this.diasAtencion = opciones.diasAtencion ?? [];
    this.apertura = opciones.apertura ?? "09:00";
    this.cierre = opciones.cierre ?? "18:00";
    this.tiposAnimales = opciones.tiposAnimales ?? [...TiposMascota.TODOS];
    this.duraciones = opciones.duraciones ?? {};
    this.sedes = opciones.sedes ?? [];
  }

  /** El lugar con ese id; si no se indica (o ya no existe) el principal. */
  sede(id: string | null | undefined): SedeVet | null {
    return this.sedes.find((s) => s.id === id) ?? this.sedes[0] ?? null;
  }

  get tieneAcceso(): boolean {
    return this.estado === "ACTIVO";
  }

  /** Cuánto dura un turno de [servicio] con este veterinario. */
  duracionDe(servicio: string | null | undefined): number {
    const buscado = servicio?.trim().toLowerCase();
    const par = Object.entries(this.duraciones).find(([k]) => k.toLowerCase() === buscado);
    if (par) {
      return Math.min(CatalogoMedico.DURACION_MAXIMA_MIN, Math.max(CatalogoMedico.DURACION_MINIMA_MIN, par[1]));
    }
    return CatalogoMedico.duracionPorDefecto(servicio);
  }

  /** True si atiende mascotas de ese tipo (lo que no tiene nombre propio cuenta como "Otro"). */
  atiende(tipoMascota: string | null | undefined): boolean {
    return this.tiposAnimales.includes(TiposMascota.normalizar(tipoMascota));
  }
}

export type TipoNotificacion = "MASCOTA" | "TURNO" | "COMPLETADO" | "CANCELACION" | "ACCESO" | "CUENTA";

/** Convierte el tipo que guarda la base ("turno", "completado"...) en el de la app. */
export function tipoNotificacionDeClave(clave: string): TipoNotificacion {
  switch (clave) {
    case "mascota": return "MASCOTA";
    case "completado": return "COMPLETADO";
    case "cancelacion": return "CANCELACION";
    case "acceso": return "ACCESO";
    case "cuenta": return "CUENTA";
    default: return "TURNO";
  }
}

export class NotificacionDueno {
  constructor(
    readonly tipo: TipoNotificacion,
    readonly titulo: string,
    readonly mensaje: string,
    readonly creada: LocalDateTime = LocalDateTime.now(),
    public leida: boolean = false,
    readonly id: string = "",
  ) {}
}

export type AjusteFoto = "LLENAR" | "COMPLETA" | "CENTRADA";

export class PerfilDueno {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  dni: string;
  fotoUri: string | null;
  fotoPath: string | null;
  ajusteFoto: AjusteFoto;
  desplazamientoFotoX: number;
  desplazamientoFotoY: number;
  /** Cuenta creada por un veterinario: falta elegir la contraseña propia y aceptar los términos. */
  debeCambiarPassword: boolean;

  constructor(
    nombre: string,
    email: string,
    telefono: string,
    direccion: string,
    opciones: {
      dni?: string;
      fotoUri?: string | null;
      fotoPath?: string | null;
      ajusteFoto?: AjusteFoto;
      desplazamientoFotoX?: number;
      desplazamientoFotoY?: number;
      debeCambiarPassword?: boolean;
    } = {},
  ) {
    this.nombre = nombre;
    this.email = email;
    this.telefono = telefono;
    this.direccion = direccion;
    this.dni = opciones.dni ?? "";
    this.fotoUri = opciones.fotoUri ?? null;
    this.fotoPath = opciones.fotoPath ?? null;
    this.ajusteFoto = opciones.ajusteFoto ?? "LLENAR";
    this.desplazamientoFotoX = opciones.desplazamientoFotoX ?? 0;
    this.desplazamientoFotoY = opciones.desplazamientoFotoY ?? 0;
    this.debeCambiarPassword = opciones.debeCambiarPassword ?? false;
  }

  get primerNombre(): string {
    return this.nombre.trim().split(/\s+/)[0] ?? "";
  }
}
