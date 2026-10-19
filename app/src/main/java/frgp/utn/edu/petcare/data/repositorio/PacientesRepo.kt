package frgp.utn.edu.petcare.data.repositorio

import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.MascotaParaCuentaDto
import frgp.utn.edu.petcare.data.remoto.NuevaCuentaDuenoDto
import frgp.utn.edu.petcare.data.remoto.NuevaMascotaDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.ui.common.Documentos
import frgp.utn.edu.petcare.util.Fechas
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
    val email: String,
    /** Alergias, carácter y condiciones a tener en cuenta en cada consulta. */
    val alertas: String = "",
    /** Falso cuando el dueño todavía no usa la app: la mascota está a nombre del veterinario. */
    val tieneCuenta: Boolean = true,
    /** DNI del propietario cuando se cargó a mano; sirve para crearle la cuenta. */
    val dniPropietario: String = "",
    /** Foto de perfil del dueño cuando tiene cuenta (ruta en el bucket `fotos`). */
    val fotoDueno: String? = null,
    val estado: frgp.utn.edu.petcare.model.EstadoMascota = frgp.utn.edu.petcare.model.EstadoMascota.ACTIVA
) {
    val razaYSexo: String get() = "$raza - $sexo"

    /** Para turnos nuevos: las inactivas y las fallecidas no se agendan. */
    val estaActiva: Boolean get() = estado == frgp.utn.edu.petcare.model.EstadoMascota.ACTIVA

    /** La ficha tal como se imprime en una receta o un certificado (sin los "Sin datos"). */
    fun comoDocumento() = Documentos.DatosPaciente(
        nombre = nombre, especie = especie, raza = raza.takeIf { it != especie }.orEmpty(),
        sexo = sexo.takeIf { it != "Sin datos" }.orEmpty(),
        edad = Regex("\\((.+)\\)").find(nacimiento)?.groupValues?.get(1).orEmpty(),
        peso = peso.takeIf { it != "Sin datos" }.orEmpty(),
        microchip = microchip.takeIf { it != "Sin datos" }.orEmpty(),
        propietario = propietario.takeIf { it != "Sin datos" }.orEmpty()
    )
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
            email = dueno?.email ?: m.propietarioEmail ?: SIN_DATOS,
            alertas = m.alertasClinicas.orEmpty(),
            tieneCuenta = m.duenoId != null,
            dniPropietario = m.propietarioDni.orEmpty(),
            fotoDueno = dueno?.fotoPath,
            estado = frgp.utn.edu.petcare.model.EstadoMascota.deClave(m.estado)
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
            telefono = telefono.ifBlank { SIN_DATOS }, email = email.ifBlank { SIN_DATOS },
            tieneCuenta = false, dniPropietario = dni
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

    /** Resultado de crearle la cuenta a un dueño: con estos datos el dueño ingresa por primera vez. */
    class CuentaCreada(val email: String, val passwordTemporal: String, val mascotas: List<String>, val mascotaIds: List<String>)

    /**
     * El veterinario le crea la cuenta al dueño de un paciente: el servidor deja las mascotas a su nombre y el
     * veterinario conserva el acceso. Con [existentes] se vinculan pacientes ya cargados; [nuevas] se crean ahora.
     * Es una operación del servidor, así que no hay copia optimista: se espera la respuesta.
     */
    suspend fun crearCuentaDueno(
        nombre: String, dni: String, telefono: String, email: String, direccion: String = "",
        nuevas: List<MascotaParaCuentaDto> = emptyList(), existentes: List<String> = emptyList()
    ): CuentaCreada {
        val respuesta = Servicios.fuente.crearCuentaDueno(
            NuevaCuentaDuenoDto(
                nombre = nombre.trim(), dni = dni.trim(), telefono = telefono.trim(), email = email.trim().lowercase(),
                direccion = direccion.trim().ifBlank { null }, mascotasNuevas = nuevas, mascotasExistentes = existentes
            )
        )
        cargar()
        Servicios.avisarCambio()
        return CuentaCreada(
            email = respuesta.email, passwordTemporal = respuesta.passwordTemporal,
            mascotas = respuesta.mascotas.map { it.nombre }, mascotaIds = respuesta.mascotas.map { it.id }
        )
    }

    /** Pacientes sin cuenta de dueño que comparten propietario con [paciente] (mismo DNI o, si no hay, mismo nombre). */
    fun mismoPropietarioSinCuenta(paciente: Paciente): List<Paciente> = lista.filter { otro ->
        !otro.tieneCuenta && when {
            paciente.dniPropietario.isNotBlank() -> otro.dniPropietario == paciente.dniPropietario
            else -> otro.propietario.equals(paciente.propietario, ignoreCase = true)
        }
    }

    fun porId(id: String?): Paciente? = lista.firstOrNull { it.id == id }

    /** El peso medido en una consulta pasa a ser el del paciente; el servidor hace lo mismo al guardar el informe. */
    fun actualizarPeso(id: String, kg: Double) {
        val i = lista.indexOfFirst { it.id == id }
        if (i < 0) return
        lista[i] = lista[i].copy(peso = if (kg % 1.0 == 0.0) "${kg.toInt()} kg" else "$kg kg")
    }

    /** Cambia las alertas clínicas del paciente; se ven ya y se guardan en segundo plano. */
    fun guardarAlertas(id: String, alertas: String) {
        val i = lista.indexOfFirst { it.id == id }
        if (i < 0) return
        lista[i] = lista[i].copy(alertas = alertas.trim())
        Servicios.escribir(alFallar = { cargar(); Servicios.avisarCambio() }) {
            Servicios.fuente.guardarAlertas(id, alertas.trim())
        }
    }

    /** Foto de perfil del dueño de ese paciente, si tiene cuenta y subió una. */
    fun fotoDuenoDe(id: String?): String? = porId(id)?.fotoDueno

    /** Nombre del paciente para mostrar en listas aunque ya no esté disponible. */
    fun nombreDe(id: String?): String = porId(id)?.nombre ?: "Mascota"

    fun filtrar(consulta: String, especie: String?): List<Paciente> {
        val q = consulta.trim().lowercase()
        return pacientes.filter { p ->
            val coincideEspecie = when (especie) {
                null -> true
                ESPECIE_OTRO -> !TiposMascota.esConocido(p.especie)
                else -> p.especie == especie
            }
            coincideEspecie && (q.isEmpty() ||
                p.nombre.lowercase().contains(q) ||
                p.raza.lowercase().contains(q) ||
                p.propietario.lowercase().contains(q))
        }
    }
}
