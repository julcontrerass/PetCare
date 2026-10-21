package frgp.utn.edu.petcare.data.repositorio

import frgp.utn.edu.petcare.data.remoto.ActividadDto
import frgp.utn.edu.petcare.data.remoto.MascotaDto
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import java.time.LocalDateTime
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

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
    var credencialPath: String? = null,
    /** Ya tenía cuenta de dueño y pidió el alta como veterinario sobre esa misma cuenta. */
    val tambienEsDueno: Boolean = false
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

    // Cada carga arma listas nuevas y las reemplaza de una vez: la pantalla nunca recorre una lista a medio llenar
    @Volatile
    var listaVeterinarios: List<VetAdminItem> = emptyList()
        private set

    @Volatile
    var listaDuenos: List<DuenoAdminItem> = emptyList()
        private set

    @Volatile
    var actividad: List<ActividadAdmin> = emptyList()
        private set

    @Volatile
    private var resumen: JsonObject = JsonObject(emptyMap())

    fun limpiar() {
        ultimaCarga = 0L
        listaVeterinarios = emptyList()
        listaDuenos = emptyList()
        actividad = emptyList()
        resumen = JsonObject(emptyMap())
    }

    /** Cuándo terminó la última carga completa; evita volver a pedir todo apenas se abre el panel. */
    @Volatile
    private var ultimaCarga = 0L

    fun cargadoHaceMs(): Long = System.currentTimeMillis() - ultimaCarga

    suspend fun cargar() {
        val f = Servicios.fuente
        // Los cuatro pedidos no dependen entre sí: se hacen a la vez en vez de uno detrás del otro
        val (perfiles, mascotas, movimientos, datosResumen) = coroutineScope {
            val perfilesPedido = async { f.perfilesAdmin() }
            val mascotasPedido = async { f.mascotasAdmin() }
            val movimientosPedido = async { f.actividadAdmin() }
            val resumenPedido = async { f.resumenAdmin() }
            DatosAdmin(perfilesPedido.await(), mascotasPedido.await(), movimientosPedido.await(), resumenPedido.await())
        }

        // El armado de las listas no toca el hilo principal
        val (vets, duenos, movs) = withContext(Dispatchers.Default) {
            val mascotasPorDueno = mascotas.filter { it.duenoId != null }.groupBy { it.duenoId }
            Triple(
                perfiles.filter { it.veterinarios != null }.map(::aVeterinario),
                perfiles.filter { it.rol == "dueno" }.map { aDueno(it, mascotasPorDueno[it.id].orEmpty()) },
                movimientos.map(::aActividad)
            )
        }
        listaVeterinarios = vets
        listaDuenos = duenos
        actividad = movs
        resumen = datosResumen
        ultimaCarga = System.currentTimeMillis()
    }

    private data class DatosAdmin(
        val perfiles: List<PerfilDto>,
        val mascotas: List<MascotaDto>,
        val movimientos: List<ActividadDto>,
        val resumen: JsonObject
    )

    /** Vuelve a pedir lo que cambia cuando el administrador actúa (cuentas, actividad y contadores). */
    private suspend fun recargar() {
        cargar()
        Servicios.avisarCambio()
    }

    private fun aVeterinario(p: PerfilDto): VetAdminItem {
        val v = p.veterinarios
        val lugares = v?.lugares().orEmpty()
        val principal = lugares.firstOrNull()
        return VetAdminItem(
            id = p.id, nombre = p.nombre, email = p.email, matricula = v?.matricula.orEmpty(),
            clinica = lugares.joinToString(" · ") { it.nombre }.ifBlank { v?.clinica.orEmpty() },
            direccion = lugares.mapNotNull { it.direccion?.takeIf { d -> d.isNotBlank() } }.joinToString("\n")
                .ifBlank { v?.direccionClinica.orEmpty() },
            telefono = p.telefono.orEmpty(),
            especialidades = v?.especialidades.orEmpty().joinToString(", "),
            diasYHorarios = if (lugares.size > 1) {
                lugares.joinToString("\n") {
                    it.nombre + ": " + textoHorarios(it.diasAtencion.sorted(), it.horaApertura, it.horaCierre)
                }
            } else {
                textoHorarios(
                    (principal?.diasAtencion ?: v?.diasAtencion.orEmpty()).sorted(),
                    principal?.horaApertura ?: v?.horaApertura, principal?.horaCierre ?: v?.horaCierre
                )
            },
            // El estado del rol de veterinario es el que se revisa; el de la cuenta puede ser otro (dueño activo)
            estado = (v?.estadoRevision ?: p.estado).uppercase(), dni = p.privados?.dni.orEmpty(), fotoPath = p.fotoPath,
            fechaRegistro = Fechas.instante(p.createdAt).toLocalDate(),
            motivo = (v?.motivoRevision ?: p.motivoEstado).orEmpty(),
            credencialPath = v?.credencialPath, tambienEsDueno = p.rol == "dueno"
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

    /** Revisión del rol de veterinario: no toca la cuenta de dueño de quien también tiene mascotas. */
    private fun revisarRol(id: String, estado: String, motivo: String?) {
        Servicios.escribir(alFallar = { recargar() }, alTerminar = { recargar() }) {
            Servicios.fuente.revisarVeterinario(id, estado.lowercase(), motivo?.ifBlank { null })
        }
    }

    fun aprobarVet(id: String) {
        val vet = vetPorId(id) ?: return
        vet.estado = ACTIVO
        vet.motivo = ""
        revisarRol(id, ACTIVO, null)
    }

    fun rechazarVet(id: String, motivo: String = "") {
        val vet = vetPorId(id) ?: return
        vet.estado = RECHAZADO
        vet.motivo = motivo
        revisarRol(id, RECHAZADO, motivo)
    }

    fun suspenderVet(id: String, motivo: String = "") {
        val vet = vetPorId(id) ?: return
        vet.estado = SUSPENDIDO
        vet.motivo = motivo
        revisarRol(id, SUSPENDIDO, motivo)
    }

    fun reactivarVet(id: String) {
        val vet = vetPorId(id) ?: return
        vet.estado = ACTIVO
        vet.motivo = ""
        revisarRol(id, ACTIVO, null)
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
