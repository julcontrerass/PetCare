package frgp.utn.edu.petcare.data.remoto

import frgp.utn.edu.petcare.model.TiposMascota
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

/*
 * Filas tal como las devuelve y recibe Supabase. Los nombres de las columnas van en snake_case,
 * igual que en la base. Los repositorios las convierten a los modelos que usa la interfaz.
 */

@Serializable
data class PerfilDto(
    val id: String,
    val rol: String,
    val estado: String,
    @SerialName("motivo_estado") val motivoEstado: String? = null,
    val nombre: String,
    val email: String,
    val telefono: String? = null,
    val direccion: String? = null,
    @SerialName("foto_path") val fotoPath: String? = null,
    @SerialName("foto_ajuste") val fotoAjuste: JsonObject? = null,
    val preferencias: JsonObject? = null,
    @SerialName("created_at") val createdAt: String? = null,
    /** Cuenta creada por un veterinario: el dueño todavía tiene que elegir su contraseña y aceptar los términos. */
    @SerialName("debe_cambiar_password") val debeCambiarPassword: Boolean = false,
    /** Datos profesionales: solo vienen cuando el perfil es de un veterinario y se pidió el embebido. */
    val veterinarios: VeterinarioDto? = null,
    /** DNI: solo viene para el propio usuario o para el administrador. */
    @SerialName("perfiles_privados") val privados: PrivadoDto? = null
)

@Serializable
data class PrivadoDto(val dni: String? = null)

@Serializable
data class VeterinarioDto(
    @SerialName("profile_id") val profileId: String? = null,
    val matricula: String = "",
    val clinica: String? = null,
    @SerialName("direccion_clinica") val direccionClinica: String? = null,
    @SerialName("dias_atencion") val diasAtencion: List<Int> = listOf(1, 2, 3, 4, 5),
    @SerialName("hora_apertura") val horaApertura: String = "09:00:00",
    @SerialName("hora_cierre") val horaCierre: String = "18:00:00",
    val especialidades: List<String> = emptyList(),
    /** Tipos de mascota que atiende; si el servidor no lo informa se asume que atiende todos. */
    @SerialName("tipos_animales") val tiposAnimales: List<String> = TiposMascota.TODOS,
    /** Minutos que dura cada servicio o especialidad para este veterinario (lo que no está usa el valor por defecto). */
    val duraciones: Map<String, Int> = emptyMap(),
    @SerialName("credencial_path") val credencialPath: String? = null,
    /** Estado de la revisión del rol de veterinario: pendiente_revision, activo, rechazado o suspendido. */
    @SerialName("estado_revision") val estadoRevision: String = "activo",
    @SerialName("motivo_revision") val motivoRevision: String? = null
)

/** La cuenta está activa y su rol de veterinario fue aprobado: puede atender y aparece en el catálogo. */
val PerfilDto.atiendeComoVeterinario: Boolean
    get() = estado == "activo" && veterinarios?.estadoRevision == "activo"

@Serializable
data class DuenoResumenDto(
    val nombre: String? = null,
    val email: String? = null,
    val telefono: String? = null,
    val direccion: String? = null,
    @SerialName("foto_path") val fotoPath: String? = null
)

@Serializable
data class MascotaDto(
    val id: String,
    @SerialName("dueno_id") val duenoId: String? = null,
    val nombre: String,
    val tipo: String,
    val raza: String? = null,
    val nacimiento: String? = null,
    val sexo: String? = null,
    @SerialName("peso_kg") val pesoKg: Double? = null,
    val microchip: String? = null,
    val color: String? = null,
    val observaciones: String? = null,
    @SerialName("foto_path") val fotoPath: String? = null,
    val activa: Boolean = true,
    @SerialName("creada_por") val creadaPor: String? = null,
    @SerialName("propietario_nombre") val propietarioNombre: String? = null,
    @SerialName("propietario_dni") val propietarioDni: String? = null,
    @SerialName("propietario_telefono") val propietarioTelefono: String? = null,
    @SerialName("propietario_email") val propietarioEmail: String? = null,
    @SerialName("propietario_direccion") val propietarioDireccion: String? = null,
    /** Alergias, carácter y condiciones a tener en cuenta en cada consulta. */
    @SerialName("alertas_clinicas") val alertasClinicas: String? = null,
    /** Perfil del dueño registrado; solo viene en las consultas del veterinario. */
    val dueno: DuenoResumenDto? = null
)

@Serializable
data class TurnoDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("veterinario_id") val veterinarioId: String? = null,
    val categoria: String,
    val motivo: String? = null,
    val fecha: String,
    val hora: String,
    val estado: String = "pendiente",
    val notas: String? = null,
    @SerialName("creado_por") val creadoPor: String? = null,
    @SerialName("cancelado_por") val canceladoPor: String? = null,
    /** Minutos que dura el turno; lo fija el servidor según el servicio y el veterinario. */
    @SerialName("duracion_min") val duracionMin: Int = 30
)

@Serializable
data class AccesoDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("veterinario_id") val veterinarioId: String,
    val estado: String,
    @SerialName("iniciado_por") val iniciadoPor: String,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    /** Turno que el veterinario dejó pedido junto con el acceso: se agenda solo cuando el dueño acepta. */
    @SerialName("turno_propuesto") val turnoPropuesto: JsonObject? = null
)

@Serializable
data class RegistroSaludDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    val tipo: String,
    val titulo: String,
    val detalle: String? = null,
    val fecha: String,
    @SerialName("fecha_fin") val fechaFin: String? = null,
    @SerialName("proxima_dosis") val proximaDosis: String? = null,
    val estado: String? = null,
    @SerialName("archivo_path") val archivoPath: String? = null,
    @SerialName("creado_por") val creadoPor: String? = null,
    /** Solo en vacunas: producto aplicado, lote y vencimiento del lote. */
    val marca: String? = null,
    val lote: String? = null,
    @SerialName("lote_vencimiento") val loteVencimiento: String? = null
)

@Serializable
data class InformeDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("turno_id") val turnoId: String? = null,
    @SerialName("veterinario_id") val veterinarioId: String? = null,
    val motivo: String? = null,
    val diagnostico: String? = null,
    val tratamiento: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    val anamnesis: String? = null,
    @SerialName("examen_fisico") val examenFisico: String? = null,
    @SerialName("peso_kg") val pesoKg: Double? = null,
    @SerialName("temperatura_c") val temperaturaC: Double? = null,
    @SerialName("frecuencia_cardiaca") val frecuenciaCardiaca: Int? = null,
    @SerialName("frecuencia_respiratoria") val frecuenciaRespiratoria: Int? = null
)

@Serializable
data class ArchivoDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    val nombre: String,
    val extension: String,
    @SerialName("storage_path") val storagePath: String,
    @SerialName("tamano_bytes") val tamanoBytes: Long? = null,
    @SerialName("subido_por") val subidoPor: String? = null,
    /** Turno al que pertenece el archivo cuando se adjuntó al informe de una consulta. */
    @SerialName("turno_id") val turnoId: String? = null,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class NotificacionDto(
    val id: String,
    val tipo: String,
    val titulo: String,
    val mensaje: String,
    val leida: Boolean = false,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class ActividadDto(
    val id: String,
    val tipo: String,
    val texto: String,
    @SerialName("created_at") val createdAt: String
)

/** Estudio anterior que el dueño adjuntó a un turno para que el veterinario lo vea. */
@Serializable
data class EstudioTurnoDto(
    val id: String,
    @SerialName("turno_id") val turnoId: String,
    @SerialName("storage_path") val storagePath: String,
    val nombre: String,
    val extension: String = "pdf",
    /** Qué clase de estudio es: radiografía, análisis de sangre, etc. */
    val tipo: String = "Estudio"
)

@Serializable
data class NuevoEstudioTurnoDto(
    @SerialName("turno_id") val turnoId: String,
    @SerialName("storage_path") val storagePath: String,
    val nombre: String,
    val extension: String,
    val tipo: String,
    @SerialName("adjuntado_por") val adjuntadoPor: String
)

/** Resultado de buscar un dueño por correo o DNI (función `buscar_dueno`). */
@Serializable
data class DuenoBuscadoDto(
    val id: String,
    val nombre: String,
    val telefono: String? = null,
    val email: String? = null,
    val mascotas: JsonArray = JsonArray(emptyList())
)

/** Una solicitud de acceso tal como la ve el veterinario (función `mis_solicitudes`). */
@Serializable
data class SolicitudAccesoDto(
    val id: String,
    @SerialName("mascota_nombre") val mascotaNombre: String,
    @SerialName("mascota_tipo") val mascotaTipo: String? = null,
    @SerialName("dueno_nombre") val duenoNombre: String? = null,
    val estado: String,
    @SerialName("iniciado_por") val iniciadoPor: String,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class HoraOcupadaDto(
    val hora: String,
    @SerialName("duracion_min") val duracionMin: Int = 30
)

/** Mascota que se carga junto con la cuenta que el veterinario le crea al dueño. */
@Serializable
data class MascotaParaCuentaDto(
    val nombre: String,
    val tipo: String,
    val sexo: String? = null,
    val raza: String? = null,
    val nacimiento: String? = null,
    @SerialName("peso_kg") val pesoKg: Double? = null,
    val color: String? = null,
    val microchip: String? = null
)

/** Pedido a la función `crear-cuenta-dueno`. */
@Serializable
data class NuevaCuentaDuenoDto(
    val nombre: String,
    val dni: String,
    val telefono: String,
    val email: String,
    val direccion: String? = null,
    /** Mascotas que se crean junto con la cuenta. */
    @SerialName("mascotas_nuevas") val mascotasNuevas: List<MascotaParaCuentaDto> = emptyList(),
    /** Mascotas que el veterinario ya había cargado sin dueño con cuenta. */
    @SerialName("mascotas_existentes") val mascotasExistentes: List<String> = emptyList()
)

/** Lo que devuelve la función al crear la cuenta: con esto el dueño ingresa por primera vez. */
@Serializable
data class CuentaDuenoCreadaDto(
    @SerialName("usuario_id") val usuarioId: String,
    val email: String,
    @SerialName("password_temporal") val passwordTemporal: String,
    val mascotas: List<MascotaCreadaDto> = emptyList()
)

@Serializable
data class MascotaCreadaDto(val id: String, val nombre: String)

/** Datos con los que un dueño pide el alta como veterinario (función `solicitar_alta_veterinario`). */
data class SolicitudAltaVeterinarioDto(
    val matricula: String,
    val clinica: String,
    val direccionClinica: String,
    /** Días de atención como en la base: 1 = lunes ... 7 = domingo. */
    val dias: List<Int>,
    val apertura: String,
    val cierre: String,
    val especialidades: List<String>,
    val tiposAnimales: List<String>,
    /** Ruta de la foto del carnet o matrícula, ya subida al bucket `credenciales`. */
    val credencialPath: String
)

/** Archivo de Storage que hay que borrar antes de eliminar la cuenta. */
@Serializable
data class RutaDto(val bucket: String, val ruta: String)

// ---------- Altas (solo los campos que manda el cliente; el resto lo completa la base) ----------

@Serializable
data class NuevaMascotaDto(
    val id: String,
    @SerialName("dueno_id") val duenoId: String? = null,
    val nombre: String,
    val tipo: String,
    val raza: String? = null,
    val nacimiento: String? = null,
    val sexo: String? = null,
    @SerialName("peso_kg") val pesoKg: Double? = null,
    val microchip: String? = null,
    val color: String? = null,
    val observaciones: String? = null,
    @SerialName("foto_path") val fotoPath: String? = null,
    @SerialName("propietario_nombre") val propietarioNombre: String? = null,
    @SerialName("propietario_dni") val propietarioDni: String? = null,
    @SerialName("propietario_telefono") val propietarioTelefono: String? = null,
    @SerialName("propietario_email") val propietarioEmail: String? = null,
    @SerialName("propietario_direccion") val propietarioDireccion: String? = null
)

@Serializable
data class NuevoTurnoDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("veterinario_id") val veterinarioId: String? = null,
    val categoria: String,
    val motivo: String? = null,
    val fecha: String,
    val hora: String,
    val estado: String = "pendiente",
    val notas: String? = null,
    @SerialName("creado_por") val creadoPor: String
)

@Serializable
data class NuevoAccesoDto(
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("veterinario_id") val veterinarioId: String,
    val estado: String,
    @SerialName("iniciado_por") val iniciadoPor: String
)

@Serializable
data class NuevoRegistroSaludDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    val tipo: String,
    val titulo: String,
    val detalle: String? = null,
    val fecha: String,
    @SerialName("fecha_fin") val fechaFin: String? = null,
    @SerialName("proxima_dosis") val proximaDosis: String? = null,
    val estado: String? = null,
    @SerialName("archivo_path") val archivoPath: String? = null,
    @SerialName("creado_por") val creadoPor: String,
    val marca: String? = null,
    val lote: String? = null,
    @SerialName("lote_vencimiento") val loteVencimiento: String? = null
)

@Serializable
data class NuevoInformeDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("turno_id") val turnoId: String? = null,
    @SerialName("veterinario_id") val veterinarioId: String,
    val motivo: String? = null,
    val diagnostico: String? = null,
    val tratamiento: String? = null,
    val anamnesis: String? = null,
    @SerialName("examen_fisico") val examenFisico: String? = null,
    @SerialName("peso_kg") val pesoKg: Double? = null,
    @SerialName("temperatura_c") val temperaturaC: Double? = null,
    @SerialName("frecuencia_cardiaca") val frecuenciaCardiaca: Int? = null,
    @SerialName("frecuencia_respiratoria") val frecuenciaRespiratoria: Int? = null
)

/** Un medicamento recetado; los de una misma consulta comparten `turnoId`. */
@Serializable
data class PrescripcionDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("turno_id") val turnoId: String? = null,
    @SerialName("veterinario_id") val veterinarioId: String? = null,
    val medicamento: String,
    val dosis: String? = null,
    @SerialName("frecuencia_horas") val frecuenciaHoras: Int? = null,
    @SerialName("duracion_dias") val duracionDias: Int? = null,
    val indicaciones: String? = null,
    val inicio: String,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class NuevaPrescripcionDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("turno_id") val turnoId: String? = null,
    @SerialName("veterinario_id") val veterinarioId: String,
    val medicamento: String,
    val dosis: String? = null,
    @SerialName("frecuencia_horas") val frecuenciaHoras: Int? = null,
    @SerialName("duracion_dias") val duracionDias: Int? = null,
    val indicaciones: String? = null,
    val inicio: String
)

@Serializable
data class NuevoArchivoDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    val nombre: String,
    val extension: String,
    @SerialName("storage_path") val storagePath: String,
    @SerialName("tamano_bytes") val tamanoBytes: Long? = null,
    @SerialName("subido_por") val subidoPor: String,
    @SerialName("turno_id") val turnoId: String? = null
)
