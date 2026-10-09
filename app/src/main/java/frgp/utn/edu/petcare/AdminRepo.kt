package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.remoto.ActividadDto
import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate
import java.time.LocalDateTime

data class VetAdminItem(
    val id: String,
    var nombre: String,
    var email: String,
    var matricula: String,
    var clinica: String,
    var direccion: String,
    var telefono: String,
    var especialidades: String,
    var diasYHorarios: String,
    var estado: String, // AdminRepo.PENDIENTE, ACTIVO, RECHAZADO o SUSPENDIDO
    var dni: String = "",
    var fotoPath: String? = null,
    var fechaRegistro: LocalDate = LocalDate.now(),
    /** Motivo del rechazo o de la suspensión, para que el veterinario sepa qué pasó. */
    var motivo: String = "",
    /** Ruta de la foto de la credencial en el bucket privado `credenciales` (solo la ve el administrador). */
    var credencialPath: String? = null
)

data class DuenoAdminItem(
    val id: String,
    val nombre: String,
    val dni: String,
    val email: String,
    val telefono: String,
    val direccion: String,
    val mascotas: List<String>,
    var estado: String = AdminRepo.ACTIVO, // ACTIVO o SUSPENDIDO
    val fotoPath: String? = null,
    val fechaRegistro: LocalDate = LocalDate.now(),
    var motivo: String = ""
)

enum class TipoActividad { REGISTRO, APROBACION, RECHAZO, SUSPENSION, REACTIVACION, BAJA }

data class ActividadAdmin(val tipo: TipoActividad, val texto: String, val cuando: LocalDateTime)

/** Cuentas, mascotas y movimientos de toda la plataforma, solo para el administrador. */
object AdminRepo {

    const val PENDIENTE = "PENDIENTE_REVISION"
    const val ACTIVO = "ACTIVO"
    const val RECHAZADO = "RECHAZADO"
    const val SUSPENDIDO = "SUSPENDIDO"

    private val dias = arrayOf("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")

    val listaVeterinarios = mutableListOf<VetAdminItem>()
    val listaDuenos = mutableListOf<DuenoAdminItem>()
    val actividad = mutableListOf<ActividadAdmin>()

    private var resumen: JsonObject = JsonObject(emptyMap())

    fun limpiar() {
        listaVeterinarios.clear()
        listaDuenos.clear()
        actividad.clear()
        resumen = JsonObject(emptyMap())
    }

    suspend fun cargar() {
        val f = Servicios.fuente
        val perfiles = f.perfilesAdmin()
        val mascotas = f.mascotasAdmin()
        val movimientos = f.actividadAdmin()
        val datosResumen = f.resumenAdmin()

        val mascotasPorDueno = mascotas.filter { it.duenoId != null }.groupBy { it.duenoId }
        listaVeterinarios.clear()
        listaVeterinarios.addAll(perfiles.filter { it.rol == "veterinario" }.map(::aVeterinario))
        listaDuenos.clear()
        listaDuenos.addAll(perfiles.filter { it.rol == "dueno" }.map { aDueno(it, mascotasPorDueno[it.id].orEmpty()) })
        actividad.clear()
        actividad.addAll(movimientos.map(::aActividad))
        resumen = datosResumen
    }

    /** Vuelve a pedir lo que cambia cuando el administrador actúa (cuentas, actividad y contadores). */
    private suspend fun recargar() {
        cargar()
        Servicios.avisarCambio()
    }

    private fun aVeterinario(p: PerfilDto): VetAdminItem {
        val v = p.veterinarios
        val diasAtencion = v?.diasAtencion.orEmpty().sorted()
        return VetAdminItem(
            id = p.id, nombre = p.nombre, email = p.email, matricula = v?.matricula.orEmpty(),
            clinica = v?.clinica.orEmpty(), direccion = v?.direccionClinica.orEmpty(), telefono = p.telefono.orEmpty(),
            especialidades = v?.especialidades.orEmpty().joinToString(", "),
            diasYHorarios = textoHorarios(diasAtencion, v?.horaApertura, v?.horaCierre),
            estado = p.estado.uppercase(), dni = p.privados?.dni.orEmpty(), fotoPath = p.fotoPath,
            fechaRegistro = Fechas.instante(p.createdAt).toLocalDate(), motivo = p.motivoEstado.orEmpty(),
            credencialPath = v?.credencialPath
        )
    }

    private fun aDueno(p: PerfilDto, mascotas: List<MascotaDto>) = DuenoAdminItem(
        id = p.id, nombre = p.nombre, dni = p.privados?.dni.orEmpty(), email = p.email,
        telefono = p.telefono.orEmpty(), direccion = p.direccion.orEmpty(),
        mascotas = mascotas.map { m -> m.raza?.takeIf { it.isNotBlank() }?.let { "${m.nombre} ($it)" } ?: "${m.nombre} (${m.tipo})" },
        estado = p.estado.uppercase(), fotoPath = p.fotoPath, fechaRegistro = Fechas.instante(p.createdAt).toLocalDate(),
        motivo = p.motivoEstado.orEmpty()
    )

    private fun aActividad(a: ActividadDto) = ActividadAdmin(
        tipo = when (a.tipo) {
            "aprobacion" -> TipoActividad.APROBACION
            "rechazo" -> TipoActividad.RECHAZO
            "suspension" -> TipoActividad.SUSPENSION
            "reactivacion" -> TipoActividad.REACTIVACION
            "baja" -> TipoActividad.BAJA
            else -> TipoActividad.REGISTRO
        },
        texto = a.texto, cuando = Fechas.instante(a.createdAt)
    )

    /** "Lun a Vie · 09:00 a 18:00 hs", o los días separados por comas si no son consecutivos. */
    private fun textoHorarios(diasAtencion: List<Int>, apertura: String?, cierre: String?): String {
        if (diasAtencion.isEmpty()) return "Sin días de atención configurados"
        val consecutivos = diasAtencion.zipWithNext().all { (a, b) -> b == a + 1 }
        val textoDias = if (consecutivos && diasAtencion.size > 2) {
            "${dias[diasAtencion.first() - 1]} a ${dias[diasAtencion.last() - 1]}"
        } else {
            diasAtencion.joinToString(", ") { dias[it - 1] }
        }
        return "$textoDias · ${(apertura ?: "09:00").take(5)} a ${(cierre ?: "18:00").take(5)} hs"
    }

    // ---------- Consultas ----------

    private fun contador(clave: String): Int = resumen[clave]?.jsonPrimitive?.intOrNull ?: 0

    fun porEstado(estado: String) = listaVeterinarios.filter { it.estado == estado }

    fun pendientesRevisionCount(): Int = listaVeterinarios.count { it.estado == PENDIENTE }

    fun vetsActivos(): Int = listaVeterinarios.count { it.estado == ACTIVO }

    fun duenosActivos(): Int = listaDuenos.count { it.estado == ACTIVO }

    fun totalMascotas(): Int = contador("mascotas")

    fun turnosHoy(): Int = contador("turnos_hoy")

    fun vetPorId(id: String) = listaVeterinarios.firstOrNull { it.id == id }

    fun duenoPorId(id: String) = listaDuenos.firstOrNull { it.id == id }

    // ---------- Acciones sobre veterinarios ----------

    private fun cambiarEstado(id: String, estado: String, motivo: String?) {
        Servicios.escribir(alFallar = { recargar() }, alTerminar = { recargar() }) {
            Servicios.fuente.cambiarEstadoCuenta(id, estado.lowercase(), motivo?.ifBlank { null })
        }
    }

    fun aprobarVet(id: String) {
        val vet = vetPorId(id) ?: return
        vet.estado = ACTIVO
        vet.motivo = ""
        cambiarEstado(id, ACTIVO, null)
    }

    fun rechazarVet(id: String, motivo: String = "") {
        val vet = vetPorId(id) ?: return
        vet.estado = RECHAZADO
        vet.motivo = motivo
        cambiarEstado(id, RECHAZADO, motivo)
    }

    fun suspenderVet(id: String, motivo: String = "") {
        val vet = vetPorId(id) ?: return
        vet.estado = SUSPENDIDO
        vet.motivo = motivo
        cambiarEstado(id, SUSPENDIDO, motivo)
    }

    fun reactivarVet(id: String) {
        val vet = vetPorId(id) ?: return
        vet.estado = ACTIVO
        vet.motivo = ""
        cambiarEstado(id, ACTIVO, null)
    }

    // ---------- Acciones sobre dueños ----------

    fun suspenderDueno(id: String, motivo: String = "") {
        val dueno = duenoPorId(id) ?: return
        dueno.estado = SUSPENDIDO
        dueno.motivo = motivo
        cambiarEstado(id, SUSPENDIDO, motivo)
    }

    fun reactivarDueno(id: String) {
        val dueno = duenoPorId(id) ?: return
        dueno.estado = ACTIVO
        dueno.motivo = ""
        cambiarEstado(id, ACTIVO, null)
    }

    // ---------- Utilidades de presentación ----------

    /** Iniciales para el avatar, sin el "Dr." o "Dra." del principio. */
    fun iniciales(nombre: String): String {
        val partes = nombre.replace(Regex("^(Dr\\.|Dra\\.)\\s*"), "").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return when {
            partes.isEmpty() -> "?"
            partes.size == 1 -> partes[0].take(1).uppercase()
            else -> (partes[0].take(1) + partes[1].take(1)).uppercase()
        }
    }
}
