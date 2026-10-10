package frgp.utn.edu.petcare.data.remoto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

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
    @SerialName("credencial_path") val credencialPath: String? = null
)

@Serializable
data class DuenoResumenDto(
    val nombre: String? = null,
    val email: String? = null,
    val telefono: String? = null,
    val direccion: String? = null
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
    @SerialName("cancelado_por") val canceladoPor: String? = null
)

@Serializable
data class AccesoDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("veterinario_id") val veterinarioId: String,
    val estado: String,
    @SerialName("iniciado_por") val iniciadoPor: String,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
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
    @SerialName("creado_por") val creadoPor: String? = null
)

@Serializable
data class InformeDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("turno_id") val turnoId: String? = null,
    @SerialName("veterinario_id") val veterinarioId: String? = null,
    val motivo: String? = null,
    val diagnostico: String? = null,
    val tratamiento: String? = null
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

@Serializable
data class HoraOcupadaDto(val hora: String)

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
    @SerialName("creado_por") val creadoPor: String
)

@Serializable
data class NuevoInformeDto(
    val id: String,
    @SerialName("mascota_id") val mascotaId: String,
    @SerialName("turno_id") val turnoId: String? = null,
    @SerialName("veterinario_id") val veterinarioId: String,
    val motivo: String? = null,
    val diagnostico: String? = null,
    val tratamiento: String? = null
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
