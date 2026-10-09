package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.NuevaMascotaDto
import java.time.LocalDate
import java.time.Period
import java.util.UUID

data class Paciente(
    val id: String,
    val nombre: String,
    val especie: String,
    val raza: String,
    val sexo: String,
    val nacimiento: String,
    val fotoPath: String?,
    val peso: String,
    val microchip: String,
    val color: String,
    val observaciones: String,
    val propietario: String,
    val direccion: String,
    val telefono: String,
    val email: String
) {
    val razaYSexo: String get() = "$raza - $sexo"
}

/** Mascotas que el veterinario en sesión puede ver: las que le compartieron y las que cargó él mismo. */
object PacientesRepo {

    const val ESPECIE_PERRO = "Perro"
    const val ESPECIE_GATO = "Gato"
    const val ESPECIE_OTRO = "Otro"
    private const val SIN_DATOS = "Sin datos"

    private val lista: MutableList<Paciente> = mutableListOf()

    val pacientes: List<Paciente> get() = lista

    fun limpiar() = lista.clear()

    suspend fun cargar() {
        val f = Servicios.fuente
        val conAcceso = f.accesos().filter { it.estado == "activo" }.map { it.mascotaId }.toSet()
        val nuevos = f.mascotasDelVeterinario()
            .filter { it.id in conAcceso || it.duenoId == null }
            .map(::aPaciente)
        lista.clear()
        lista.addAll(nuevos)
    }

    private fun aPaciente(m: MascotaDto): Paciente {
        val dueno = m.dueno
        val nacimiento = m.nacimiento?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
        val edad = nacimiento?.let { edadTexto(it) }
        return Paciente(
            id = m.id, nombre = m.nombre, especie = m.tipo, raza = m.raza?.takeIf { it.isNotBlank() } ?: m.tipo,
            sexo = m.sexo?.replaceFirstChar { it.uppercase() } ?: SIN_DATOS,
            nacimiento = nacimiento?.let { Fechas.corta(it) + (edad?.let { e -> " ($e)" } ?: "") } ?: SIN_DATOS,
            fotoPath = m.fotoPath,
            peso = m.pesoKg?.let { if (it % 1.0 == 0.0) "${it.toInt()} kg" else "$it kg" } ?: SIN_DATOS,
            microchip = m.microchip ?: SIN_DATOS, color = m.color ?: SIN_DATOS,
            observaciones = m.observaciones?.takeIf { it.isNotBlank() } ?: "Sin observaciones",
            propietario = dueno?.nombre ?: m.propietarioNombre ?: SIN_DATOS,
            direccion = dueno?.direccion ?: m.propietarioDireccion ?: SIN_DATOS,
            telefono = dueno?.telefono ?: m.propietarioTelefono ?: SIN_DATOS,
            email = dueno?.email ?: m.propietarioEmail ?: SIN_DATOS
        )
    }

    private fun edadTexto(nacimiento: LocalDate): String? {
        val periodo = Period.between(nacimiento, LocalDate.now())
        if (periodo.isNegative) return null
        if (periodo.years >= 1) return if (periodo.years == 1) "1 año" else "${periodo.years} años"
        return if (periodo.months <= 1) "1 mes" else "${periodo.months} meses"
    }

    /**
     * Da de alta una mascota cuyo dueño todavía no tiene cuenta (queda a nombre del veterinario hasta que
     * el dueño se registre). Se ve enseguida y se guarda en segundo plano.
     */
    fun agregarManual(
        nombre: String, especie: String, raza: String, sexo: String,
        propietario: String, telefono: String, email: String = "", dni: String = ""
    ): Paciente {
        val paciente = Paciente(
            id = UUID.randomUUID().toString(), nombre = nombre, especie = especie, raza = raza.ifBlank { especie },
            sexo = sexo, nacimiento = SIN_DATOS, fotoPath = null, peso = SIN_DATOS, microchip = SIN_DATOS,
            color = SIN_DATOS, observaciones = "Sin observaciones", propietario = propietario, direccion = SIN_DATOS,
            telefono = telefono.ifBlank { SIN_DATOS }, email = email.ifBlank { SIN_DATOS }
        )
        lista.add(paciente)
        Servicios.escribir(alFallar = { cargar(); Servicios.avisarCambio() }) {
            Servicios.fuente.crearMascota(
                NuevaMascotaDto(
                    id = paciente.id, nombre = nombre, tipo = especie, raza = raza.ifBlank { null },
                    sexo = sexo.lowercase().takeIf { it == "macho" || it == "hembra" },
                    propietarioNombre = propietario, propietarioDni = dni.ifBlank { null },
                    propietarioTelefono = telefono.ifBlank { null }, propietarioEmail = email.ifBlank { null }
                )
            )
        }
        return paciente
    }

    fun porId(id: String?): Paciente? = lista.firstOrNull { it.id == id }

    /** Nombre del paciente para mostrar en listas aunque ya no esté disponible. */
    fun nombreDe(id: String?): String = porId(id)?.nombre ?: "Mascota"

    fun filtrar(consulta: String, especie: String?): List<Paciente> {
        val q = consulta.trim().lowercase()
        return pacientes.filter { p ->
            val coincideEspecie = when (especie) {
                null -> true
                ESPECIE_OTRO -> p.especie != ESPECIE_PERRO && p.especie != ESPECIE_GATO
                else -> p.especie == especie
            }
            coincideEspecie && (q.isEmpty() ||
                p.nombre.lowercase().contains(q) ||
                p.raza.lowercase().contains(q) ||
                p.propietario.lowercase().contains(q))
        }
    }
}
