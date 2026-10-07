package frgp.utn.edu.petcare.model

import android.net.Uri
import androidx.annotation.DrawableRes
import frgp.utn.edu.petcare.Fechas
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period

const val SIN_DATOS = "Sin datos"

enum class Sexo(val etiqueta: String) {
    MACHO("Macho"), HEMBRA("Hembra");

    companion object {
        fun deTexto(texto: String?): Sexo? = entries.firstOrNull { it.etiqueta.equals(texto?.trim(), ignoreCase = true) }
    }
}

/** Mascota del dueño con sesión iniciada. */
class Mascota(
    var nombre: String,
    var tipo: String,
    var raza: String = "",
    var nacimiento: LocalDate? = null,
    var sexo: Sexo? = null,
    var fotoUri: Uri? = null,
    @DrawableRes var fotoRes: Int = 0,
    var peso: String = SIN_DATOS,
    var microchip: String = SIN_DATOS,
    var color: String = SIN_DATOS,
    var observaciones: String = "Sin observaciones"
) {
    /** "Perro - Golden Retriever", o solo el tipo si no se cargó la raza. */
    val tipoRazaTexto: String
        get() = if (raza.isBlank() || raza.equals(tipo, ignoreCase = true)) tipo else "$tipo - $raza"

    /** "Nacido el 15 Mar 2020 - Macho". */
    val nacimientoSexoTexto: String
        get() {
            val nacido = nacimiento?.let { "Nacido el ${Fechas.corta(it)}" } ?: "Fecha de nacimiento sin datos"
            return sexo?.let { "$nacido - ${it.etiqueta}" } ?: nacido
        }

    val tienePesoValido: Boolean
        get() = peso.isNotBlank() && !peso.equals(SIN_DATOS, ignoreCase = true)

    /** "6 años" o "3 meses"; null si no se conoce la fecha de nacimiento. */
    fun edadTexto(hoy: LocalDate = LocalDate.now()): String? {
        val nac = nacimiento ?: return null
        val periodo = Period.between(nac, hoy)
        if (periodo.isNegative) return null
        if (periodo.years >= 1) return if (periodo.years == 1) "1 año" else "${periodo.years} años"
        return if (periodo.months <= 1) "1 mes" else "${periodo.months} meses"
    }

    val inicial: String
        get() = nombre.trim().take(1).uppercase().ifEmpty { "?" }
}

/** Turno o recordatorio de una mascota. */
class EventoMascota(
    var categoria: String,
    var mascota: String,
    var veterinario: String,
    var hora: String,
    var observaciones: String,
    var fecha: LocalDate
)

enum class EstadoAcceso { ACTIVO, INACTIVO, PENDIENTE, DISPONIBLE }

/** Veterinario tal como lo ve el dueño: si tiene acceso a sus mascotas y a cuáles. */
class VeterinarioAcceso(
    var nombre: String,
    val usuario: String,
    var email: String,
    var matricula: String,
    val especialidad: String,
    var estado: EstadoAcceso,
    mascotas: Collection<String> = emptyList()
) {
    val mascotas: MutableSet<String> = LinkedHashSet(mascotas)

    val tieneAcceso: Boolean get() = estado == EstadoAcceso.ACTIVO

    companion object {
        /** Veterinario nuevo con usuario y correo generados a partir del nombre. */
        fun desdeNombre(nombre: String, especialidad: String, matricula: String): VeterinarioAcceso {
            val base = nombre.lowercase().replace(Regex("[^a-z]"), "")
            return VeterinarioAcceso(nombre, "@$base", "$base@petcare.com", matricula, especialidad, EstadoAcceso.ACTIVO)
        }
    }
}

enum class TipoNotificacion { MASCOTA, TURNO, CANCELACION, ACCESO }

class NotificacionDueno(
    val tipo: TipoNotificacion,
    val titulo: String,
    val mensaje: String,
    val creada: LocalDateTime = LocalDateTime.now()
)

enum class AjusteFoto { LLENAR, COMPLETA, CENTRADA }

class PerfilDueno(
    var nombre: String,
    var email: String,
    var telefono: String,
    var direccion: String,
    var password: String? = null,
    var fotoUri: Uri? = null,
    var ajusteFoto: AjusteFoto = AjusteFoto.LLENAR,
    var desplazamientoFotoX: Float = 0f,
    var desplazamientoFotoY: Float = 0f
) {
    val primerNombre: String get() = nombre.trim().split(Regex("\\s+")).firstOrNull().orEmpty()
}
