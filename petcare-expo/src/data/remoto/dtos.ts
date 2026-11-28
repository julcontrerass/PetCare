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
  /** Pausa de todos los días que atiende en este lugar ("13:00:00"); null si no tiene. */
  pausa_desde?: string | null;
  pausa_hasta?: string | null;
  /** Lo que ofrece en este lugar; null = todo lo que ofrece. */
  servicios?: string[] | null;
}

/** Un momento en que el veterinario no atiende (tabla bloqueos_agenda). Horas locales: "2026-11-30T08:00:00". */
export interface BloqueoDto {
  id: string;
  veterinario_id: string;
  desde: string;
  hasta: string;
  motivo: string;
}

/** Un turno que cae dentro de un bloqueo nuevo (rpc crear_bloqueo), con el contacto del dueño. */
export interface BloqueoAfectadoDto {
  turno_id: string;
  mascota: string;
  dueno?: string | null;
  telefono?: string | null;
  fecha: string;
  hora: string;
  /** Se canceló al crear el bloqueo (al dueño le llegó el aviso con el motivo). */
  cancelado: boolean;
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
  /** Especialidades con el título aprobado por el administrador (las que se ofrecen a los dueños). */
  especialidades_aprobadas?: string[];
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
    especialidades_aprobadas: v.especialidades_aprobadas ?? [],
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
    pausa_desde: s.pausa_desde ?? null,
    pausa_hasta: s.pausa_hasta ?? null,
    servicios: s.servicios ?? null,
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
  pausa_desde?: string | null;
  pausa_hasta?: string | null;
  servicios?: string[] | null;
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

/** Una toma de medicación ya dada (tabla tomas_medicacion). */
export interface TomaDto {
  id: string;
  prescripcion_id: string;
  mascota_id: string;
  /** Hora a la que tocaba la toma, local y sin zona ("2026-11-24T08:00:00"). */
  programada: string;
  /** Cuándo se tildó. */
  dada_at: string;
  registrada_por?: string | null;
}

/** Invitación a ser co-dueño de una mascota que recibió la cuenta (rpc mis_invitaciones_codueno). */
export interface InvitacionCoduenoDto {
  id: string;
  mascota_id: string;
  mascota_nombre: string;
  mascota_tipo: string;
  mascota_foto_path?: string | null;
  invitado_por_nombre?: string | null;
  created_at: string;
}

/** Rol de una cuenta dentro de una veterinaria. */
export type RolClinica = "titular" | "administrador" | "veterinario" | "recepcion";

/** Una veterinaria de la cuenta (rpc mis_clinicas): también las invitaciones que todavía no respondió. */
export interface ClinicaDto {
  id: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  /** La fila de la cuenta en el equipo (para aceptar, rechazar o salir). */
  miembro_id: string;
  roles: RolClinica[];
  estado: "pendiente" | "activo";
  invitado_por_nombre?: string | null;
  /** Cuántos veterinarios activos tiene. */
  veterinarios: number;
  created_at: string;
  /** La que registra alguien que no es veterinario espera que el administrador la verifique. */
  revision?: RevisionClinica;
  motivo_revision?: string | null;
  /** Ruta del logo en el bucket `fotos`. */
  logo_path?: string | null;
  director_nombre?: string | null;
  /** Habilitaciones que todavía no se subieron (las necesita el administrador para aprobarla). */
  falta_habilitacion_comercial?: boolean;
  falta_habilitacion_sanitaria?: boolean;
}

export type TipoHabilitacion = "comercial" | "sanitaria";

export type EstadoEspecialidad = "sin_certificado" | "pendiente" | "aprobada" | "rechazada";

/** Una especialidad elegida por el veterinario y el estado de su título (rpc mis_especialidades). */
export interface EspecialidadVetDto {
  id: string;
  especialidad: string;
  estado: EstadoEspecialidad;
  titulo?: string | null;
  institucion?: string | null;
  anio?: number | null;
  archivos: string[];
  /** Motivo del rechazo. */
  motivo?: string | null;
  enviada_at?: string | null;
}

/** El título de una especialidad: qué es, quién lo otorgó, cuándo, y los archivos ya subidos a `credenciales`. */
export interface NuevoCertificadoDto {
  especialidad: string;
  titulo: string;
  institucion: string;
  anio: number;
  archivos: string[];
}

/** Un título para revisar (rpc especialidades_para_revisar). */
export interface EspecialidadParaRevisarDto {
  id: string;
  veterinario_id: string;
  veterinario_nombre: string;
  veterinario_email: string;
  matricula: string;
  /** La cuenta del veterinario ya está aprobada (su matrícula). */
  cuenta_aprobada: boolean;
  especialidad: string;
  titulo: string;
  institucion: string;
  anio: number;
  archivos: string[];
  enviada_at: string;
}

/** Lo que se carga para registrar una veterinaria: también su CUIT y su director técnico (un veterinario matriculado). */
export interface NuevaClinicaDto {
  nombre: string;
  direccion: string;
  telefono: string;
  cuit: string;
  director: { nombre: string; dni: string; matricula: string };
}

export type RevisionClinica = "pendiente" | "aprobada" | "rechazada";

/** Veterinaria que espera la revisión del administrador (rpc clinicas_para_revisar). */
export interface ClinicaParaRevisarDto {
  id: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  created_at: string;
  titular_id?: string | null;
  titular_nombre?: string | null;
  titular_email?: string | null;
  titular_telefono?: string | null;
  titular_dni?: string | null;
  logo_path?: string | null;
  cuit?: string | null;
  director_nombre?: string | null;
  director_dni?: string | null;
  director_matricula?: string | null;
  /** El director técnico es un veterinario aprobado en PetCare (con esa matrícula o ese DNI). */
  director_en_petcare?: boolean;
  /** Rutas en el bucket `credenciales`; null si todavía no se subieron. */
  habilitacion_comercial_path?: string | null;
  habilitacion_sanitaria_path?: string | null;
}

/** Cualquier veterinaria, en la sección Veterinarias del administrador (rpc clinicas_admin). */
export interface ClinicaAdminDto extends ClinicaParaRevisarDto {
  revision: RevisionClinica;
  motivo_revision?: string | null;
  revisada_at?: string | null;
  /** Veterinarios activos en el equipo. */
  veterinarios: number;
  /** Personas activas en el equipo (todos los roles). */
  equipo: number;
}

/** Una persona del equipo de una veterinaria (rpc equipo_clinica). */
export interface MiembroClinicaDto {
  miembro_id: string;
  cuenta_id: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  foto_path?: string | null;
  roles: RolClinica[];
  estado: "pendiente" | "activo";
  es_yo: boolean;
}

/** Un veterinario cuya agenda maneja la cuenta y la veterinaria por la que la maneja (rpc agendas_que_manejo). */
export interface AgendaManejadaDto {
  clinica_id: string;
  clinica_nombre: string;
  veterinario_id: string;
}

/** Lo que se carga para crear la cuenta de una persona del equipo (Edge Function crear-cuenta-miembro). */
export interface NuevaCuentaMiembroDto {
  clinica_id: string;
  roles: RolClinica[];
  nombre: string;
  dni: string;
  telefono: string;
  email: string;
  /** Solo para un veterinario: su matrícula y la foto del carnet (jpeg en base64) para que la verifique el administrador. */
  matricula?: string;
  credencial?: string;
}

export interface CuentaMiembroCreadaDto {
  usuario_id: string;
  email: string;
  password_temporal: string;
  /** Un veterinario creado por la veterinaria queda en revisión hasta que el administrador aprueba su matrícula. */
  en_revision?: boolean;
}

/** Dueño de una mascota (o invitación pendiente), de la rpc duenos_de_mascota. */
export interface DuenoMascotaDto {
  /** Fila de coduenos_mascota; null para el dueño original. */
  codueno_id: string | null;
  usuario_id: string;
  nombre: string;
  email: string;
  foto_path?: string | null;
  /** activo o pendiente (invitación sin responder). */
  estado: string;
  es_original: boolean;
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
  /** Lo marca el veterinario o su recepción el día del turno: "en_espera" (llegó) o "no_vino". */
  llegada?: "en_espera" | "no_vino" | null;
  llegada_at?: string | null;
  /** Cuenta que hizo el último cambio del turno (el dueño, el veterinario o alguien de su recepción). */
  gestionado_por?: string | null;
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
  /** La cuenta a la que se refiere el movimiento (veterinario o dueño), si sigue existiendo. */
  objetivo_id?: string | null;
  /** La veterinaria a la que se refiere, si es un movimiento de una veterinaria. */
  clinica_id?: string | null;
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
  /** Antes, durante o después de comer, o en ayunas. */
  con_comida?: ConComida | null;
  /** Hora local de la primera dosis ("2026-11-24T19:00:00"); null si todavía no empezó. */
  empezo_at?: string | null;
  /** El veterinario cortó el tratamiento antes de tiempo. */
  suspendida_at?: string | null;
  motivo_suspension?: string | null;
}

export type ConComida = "antes" | "durante" | "despues" | "ayunas";

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
  con_comida?: ConComida | null;
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
