/*
 * Filas tal como las devuelve y recibe Supabase. Los nombres de las columnas van en snake_case, igual que
 * en la base. Los repositorios las convierten a los modelos que usa la interfaz.
 */
import type { SedeVet } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";

export type Json = string | number | boolean | null | Json[] | { [clave: string]: Json | undefined };
export type JsonObject = { [clave: string]: Json | undefined };

export interface PrivadoDto {
  dni?: string | null;
}

/** Un lugar de atención de un veterinario con sus días y horarios. */
export interface SedeDto {
  id: string;
  veterinario_id?: string | null;
  nombre: string;
  direccion?: string | null;
  dias_atencion: number[];
  hora_apertura: string;
  hora_cierre: string;
  activa: boolean;
  created_at?: string | null;
}

export interface VeterinarioDto {
  profile_id?: string | null;
  matricula: string;
  clinica?: string | null;
  direccion_clinica?: string | null;
  dias_atencion: number[];
  hora_apertura: string;
  hora_cierre: string;
  especialidades: string[];
  /** Tipos de mascota que atiende; si el servidor no lo informa se asume que atiende todos. */
  tipos_animales: string[];
  /** Minutos que dura cada servicio o especialidad para este veterinario. */
  duraciones: Record<string, number>;
  credencial_path?: string | null;
  /** Estado de la revisión del rol: pendiente_revision, activo, rechazado o suspendido. */
  estado_revision: string;
  motivo_revision?: string | null;
  /** Lugares de atención (solo vienen cuando se pidió el embebido `sedes`). */
  sedes: SedeDto[];
}

export interface PerfilDto {
  id: string;
  rol: string;
  estado: string;
  motivo_estado?: string | null;
  nombre: string;
  email: string;
  telefono?: string | null;
  direccion?: string | null;
  foto_path?: string | null;
  foto_ajuste?: JsonObject | null;
  preferencias?: JsonObject | null;
  created_at?: string | null;
  /** Cuenta creada por un veterinario: el dueño todavía tiene que elegir su contraseña y aceptar los términos. */
  debe_cambiar_password: boolean;
  /** Datos profesionales: solo vienen cuando el perfil es de un veterinario y se pidió el embebido. */
  veterinarios?: VeterinarioDto | null;
  /** DNI: solo viene para el propio usuario o para el administrador. */
  perfiles_privados?: PrivadoDto | null;
}

/** Completa lo que la base deja vacío con los valores de siempre (los mismos que tenía la app Android). */
export function normalizarVeterinario(v: Partial<VeterinarioDto> | null | undefined): VeterinarioDto | null {
  if (!v) return null;
  return {
    profile_id: v.profile_id ?? null,
    matricula: v.matricula ?? "",
    clinica: v.clinica ?? null,
    direccion_clinica: v.direccion_clinica ?? null,
    dias_atencion: v.dias_atencion ?? [1, 2, 3, 4, 5],
    hora_apertura: v.hora_apertura ?? "09:00:00",
    hora_cierre: v.hora_cierre ?? "18:00:00",
    especialidades: v.especialidades ?? [],
    tipos_animales: v.tipos_animales ?? [...TiposMascota.TODOS],
    duraciones: v.duraciones ?? {},
    credencial_path: v.credencial_path ?? null,
    estado_revision: v.estado_revision ?? "activo",
    motivo_revision: v.motivo_revision ?? null,
    sedes: (v.sedes ?? []).map(normalizarSede),
  };
}

export function normalizarSede(s: Partial<SedeDto> & { id: string; nombre: string }): SedeDto {
  return {
    id: s.id,
    veterinario_id: s.veterinario_id ?? null,
    nombre: s.nombre,
    direccion: s.direccion ?? null,
    dias_atencion: s.dias_atencion ?? [1, 2, 3, 4, 5],
    hora_apertura: s.hora_apertura ?? "09:00:00",
    hora_cierre: s.hora_cierre ?? "18:00:00",
    activa: s.activa ?? true,
    created_at: s.created_at ?? null,
  };
}

export function normalizarPerfil(p: PerfilDto): PerfilDto {
  return {
    ...p,
    debe_cambiar_password: p.debe_cambiar_password ?? false,
    veterinarios: normalizarVeterinario(p.veterinarios as Partial<VeterinarioDto> | null | undefined),
  };
}

/**
 * Los lugares donde atiende, el principal primero. Si el servidor todavía no informa ninguno se arma uno con
 * los datos de siempre (clínica, dirección, días y horario).
 */
export function lugaresDe(v: VeterinarioDto): SedeDto[] {
  const activos = v.sedes.filter((s) => s.activa).sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  if (activos.length > 0) return activos;
  return [
    {
      id: "",
      veterinario_id: v.profile_id ?? null,
      nombre: v.clinica?.trim() ? v.clinica : "Consultorio",
      direccion: v.direccion_clinica ?? null,
      dias_atencion: v.dias_atencion,
      hora_apertura: v.hora_apertura,
      hora_cierre: v.hora_cierre,
      activa: true,
      created_at: null,
    },
  ];
}

/** Datos para crear un lugar de atención; el servidor pone el resto. */
export interface NuevaSedeDto {
  id?: string | null;
  veterinario_id: string;
  nombre: string;
  direccion?: string | null;
  dias_atencion: number[];
  hora_apertura: string;
  hora_cierre: string;
}

/** La cuenta está activa y su rol de veterinario fue aprobado: puede atender y aparece en el catálogo. */
export function atiendeComoVeterinario(p: PerfilDto): boolean {
  return p.estado === "activo" && p.veterinarios?.estado_revision === "activo";
}

export interface DuenoResumenDto {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  foto_path?: string | null;
}

export interface MascotaDto {
  id: string;
  dueno_id?: string | null;
  nombre: string;
  tipo: string;
  raza?: string | null;
  nacimiento?: string | null;
  sexo?: string | null;
  peso_kg?: number | null;
  microchip?: string | null;
  color?: string | null;
  observaciones?: string | null;
  foto_path?: string | null;
  activa: boolean;
  /** activa, inactiva o fallecida. */
  estado: string;
  /** Por qué el dueño dio de baja a la mascota (fallecimiento, adopción u otro). */
  motivo_baja?: string | null;
  creada_por?: string | null;
  propietario_nombre?: string | null;
  propietario_dni?: string | null;
  propietario_telefono?: string | null;
  propietario_email?: string | null;
  propietario_direccion?: string | null;
  /** Alergias, carácter y condiciones a tener en cuenta en cada consulta. */
  alertas_clinicas?: string | null;
  /** Perfil del dueño registrado; solo viene en las consultas del veterinario. */
  dueno?: DuenoResumenDto | null;
}

export interface TurnoDto {
  id: string;
  mascota_id: string;
  veterinario_id?: string | null;
  categoria: string;
  motivo?: string | null;
  fecha: string;
  hora: string;
  estado: string;
  notas?: string | null;
  creado_por?: string | null;
  cancelado_por?: string | null;
  /** Minutos que dura el turno; lo fija el servidor según el servicio y el veterinario. */
  duracion_min: number;
  /** Lugar de atención donde es el turno. */
  sede_id?: string | null;
}

export interface AccesoDto {
  id: string;
  mascota_id: string;
  veterinario_id: string;
  estado: string;
  iniciado_por: string;
  created_at?: string | null;
  updated_at?: string | null;
  /** Turno que el veterinario dejó pedido junto con el acceso: se agenda solo cuando el dueño acepta. */
  turno_propuesto?: JsonObject | null;
  /** Último día en que el permiso sirve; null = sin vencimiento. */
  vence_el?: string | null;
}

/** Una línea del historial de permisos: quién lo dio, lo pidió o lo sacó, y cuándo. */
export interface AccesoHistorialDto {
  id: string;
  mascota_id: string;
  veterinario_id: string;
  estado: string;
  vence_el?: string | null;
  actor_id?: string | null;
  evento: string;
  created_at?: string | null;
}

export interface RegistroSaludDto {
  id: string;
  mascota_id: string;
  tipo: string;
  titulo: string;
  detalle?: string | null;
  fecha: string;
  fecha_fin?: string | null;
  proxima_dosis?: string | null;
  estado?: string | null;
  archivo_path?: string | null;
  creado_por?: string | null;
  /** Solo en vacunas: producto aplicado, lote y vencimiento del lote. */
  marca?: string | null;
  lote?: string | null;
  lote_vencimiento?: string | null;
}

export interface InformeDto {
  id: string;
  mascota_id: string;
  turno_id?: string | null;
  veterinario_id?: string | null;
  motivo?: string | null;
  diagnostico?: string | null;
  tratamiento?: string | null;
  created_at?: string | null;
  anamnesis?: string | null;
  examen_fisico?: string | null;
  peso_kg?: number | null;
  temperatura_c?: number | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
}

export interface ArchivoDto {
  id: string;
  mascota_id: string;
  nombre: string;
  extension: string;
  storage_path: string;
  tamano_bytes?: number | null;
  subido_por?: string | null;
  /** Turno al que pertenece el archivo cuando se adjuntó al informe de una consulta. */
  turno_id?: string | null;
  created_at?: string | null;
}

export interface NotificacionDto {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

export interface ActividadDto {
  id: string;
  tipo: string;
  texto: string;
  created_at: string;
}

/** Estudio anterior que el dueño adjuntó a un turno para que el veterinario lo vea. */
export interface EstudioTurnoDto {
  id: string;
  turno_id: string;
  storage_path: string;
  nombre: string;
  extension: string;
  /** Qué clase de estudio es: radiografía, análisis de sangre, etc. */
  tipo: string;
}

export interface NuevoEstudioTurnoDto {
  turno_id: string;
  storage_path: string;
  nombre: string;
  extension: string;
  tipo: string;
  adjuntado_por: string;
}

/** Resultado de buscar un dueño por correo o DNI (función `buscar_dueno`). */
export interface DuenoBuscadoDto {
  id: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  mascotas: Json[];
}

/** Una solicitud de acceso tal como la ve el veterinario (función `mis_solicitudes`). */
export interface SolicitudAccesoDto {
  id: string;
  mascota_nombre: string;
  mascota_tipo?: string | null;
  dueno_nombre?: string | null;
  estado: string;
  iniciado_por: string;
  created_at?: string | null;
  /** Foto de perfil del dueño de la mascota. */
  dueno_foto_path?: string | null;
}

export interface HoraOcupadaDto {
  hora: string;
  duracion_min: number;
}

/** Mascota que se carga junto con la cuenta que el veterinario le crea al dueño. */
export interface MascotaParaCuentaDto {
  nombre: string;
  tipo: string;
  sexo?: string | null;
  raza?: string | null;
  nacimiento?: string | null;
  peso_kg?: number | null;
  color?: string | null;
  microchip?: string | null;
}

/** Pedido a la función `crear-cuenta-dueno`. */
export interface NuevaCuentaDuenoDto {
  nombre: string;
  dni: string;
  telefono: string;
  email: string;
  direccion?: string | null;
  /** Mascotas que se crean junto con la cuenta. */
  mascotas_nuevas: MascotaParaCuentaDto[];
  /** Mascotas que el veterinario ya había cargado sin dueño con cuenta. */
  mascotas_existentes: string[];
}

export interface MascotaCreadaDto {
  id: string;
  nombre: string;
}

/** Lo que devuelve la función al crear la cuenta: con esto el dueño ingresa por primera vez. */
export interface CuentaDuenoCreadaDto {
  usuario_id: string;
  email: string;
  password_temporal: string;
  mascotas: MascotaCreadaDto[];
}

/** Datos con los que un dueño pide el alta como veterinario (función `solicitar_alta_veterinario`). */
export interface SolicitudAltaVeterinarioDto {
  matricula: string;
  clinica: string;
  direccionClinica: string;
  /** Días de atención como en la base: 1 = lunes ... 7 = domingo. */
  dias: number[];
  apertura: string;
  cierre: string;
  especialidades: string[];
  tiposAnimales: string[];
  /** Ruta de la foto del carnet o matrícula, ya subida al bucket `credenciales`. */
  credencialPath: string;
  /** Otros lugares donde atiende, además del primero. */
  sedesExtra: SedeVet[];
}

/** Archivo de Storage que hay que borrar antes de eliminar la cuenta. */
export interface RutaDto {
  bucket: string;
  ruta: string;
}

// ---------- Altas (solo los campos que manda el cliente; el resto lo completa la base) ----------

export interface NuevaMascotaDto {
  id: string;
  dueno_id?: string | null;
  nombre: string;
  tipo: string;
  raza?: string | null;
  nacimiento?: string | null;
  sexo?: string | null;
  peso_kg?: number | null;
  microchip?: string | null;
  color?: string | null;
  observaciones?: string | null;
  foto_path?: string | null;
  propietario_nombre?: string | null;
  propietario_dni?: string | null;
  propietario_telefono?: string | null;
  propietario_email?: string | null;
  propietario_direccion?: string | null;
}

export interface NuevoTurnoDto {
  id: string;
  mascota_id: string;
  veterinario_id?: string | null;
  categoria: string;
  motivo?: string | null;
  fecha: string;
  hora: string;
  estado?: string;
  notas?: string | null;
  creado_por: string;
  sede_id?: string | null;
}

export interface NuevoAccesoDto {
  mascota_id: string;
  veterinario_id: string;
  estado: string;
  iniciado_por: string;
  vence_el?: string | null;
}

export interface NuevoRegistroSaludDto {
  id: string;
  mascota_id: string;
  tipo: string;
  titulo: string;
  detalle?: string | null;
  fecha: string;
  fecha_fin?: string | null;
  proxima_dosis?: string | null;
  estado?: string | null;
  archivo_path?: string | null;
  creado_por: string;
  marca?: string | null;
  lote?: string | null;
  lote_vencimiento?: string | null;
}

export interface NuevoInformeDto {
  id: string;
  mascota_id: string;
  turno_id?: string | null;
  veterinario_id: string;
  motivo?: string | null;
  diagnostico?: string | null;
  tratamiento?: string | null;
  anamnesis?: string | null;
  examen_fisico?: string | null;
  peso_kg?: number | null;
  temperatura_c?: number | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
}

/** Un medicamento recetado; los de una misma consulta comparten `turno_id`. */
export interface PrescripcionDto {
  id: string;
  mascota_id: string;
  turno_id?: string | null;
  veterinario_id?: string | null;
  medicamento: string;
  dosis?: string | null;
  frecuencia_horas?: number | null;
  duracion_dias?: number | null;
  indicaciones?: string | null;
  inicio: string;
  created_at?: string | null;
}

export interface NuevaPrescripcionDto {
  id: string;
  mascota_id: string;
  turno_id?: string | null;
  veterinario_id: string;
  medicamento: string;
  dosis?: string | null;
  frecuencia_horas?: number | null;
  duracion_dias?: number | null;
  indicaciones?: string | null;
  inicio: string;
}

export interface NuevoArchivoDto {
  id: string;
  mascota_id: string;
  nombre: string;
  extension: string;
  storage_path: string;
  tamano_bytes?: number | null;
  subido_por: string;
  turno_id?: string | null;
}

/** Recordatorio creado a mano: por el dueño para su mascota o por el veterinario para un paciente. */
export interface RecordatorioDto {
  id: string;
  mascota_id: string;
  creado_por: string;
  titulo: string;
  tipo: string;
  fecha: string;
  hora?: string | null;
  nota?: string | null;
  created_at?: string | null;
}

export interface NuevoRecordatorioDto {
  id: string;
  mascota_id: string;
  creado_por: string;
  titulo: string;
  tipo: string;
  fecha: string;
  hora?: string | null;
  nota?: string | null;
}
