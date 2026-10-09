package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.ArchivoDto
import frgp.utn.edu.petcare.data.remoto.NuevoArchivoDto
import java.io.File
import java.util.UUID

data class ArchivoItem(
    val id: String,
    val pacienteId: String,
    val nombre: String,
    val fecha: String,
    val tipoExtension: String,
    val iconRes: Int,
    val storagePath: String
)

/** Estudios, recetas y documentos de una mascota, guardados en el bucket privado `archivos`. */
object ArchivosRepo {

    const val BUCKET = "archivos"

    private val porPaciente = mutableMapOf<String, MutableList<ArchivoItem>>()

    fun limpiar() = porPaciente.clear()

    fun dePaciente(pacienteId: String): List<ArchivoItem> = porPaciente[pacienteId].orEmpty()

    suspend fun cargar(pacienteId: String) {
        val lista = Servicios.fuente.archivosDe(pacienteId).map(::aItem)
        porPaciente[pacienteId] = lista.toMutableList()
    }

    private fun iconoDe(extension: String) = when (extension.uppercase()) {
        "DOC", "DOCX" -> R.drawable.ic_pencil
        "JPG", "JPEG", "PNG" -> R.drawable.ic_camera
        else -> R.drawable.ic_list
    }

    private fun aItem(a: ArchivoDto): ArchivoItem {
        val ext = a.extension.uppercase()
        val cuando = Fechas.instante(a.createdAt).toLocalDate()
        return ArchivoItem(
            id = a.id, pacienteId = a.mascotaId, nombre = a.nombre, fecha = "Subido el ${Fechas.corta(cuando)} · $ext",
            tipoExtension = ext, iconRes = iconoDe(ext), storagePath = a.storagePath
        )
    }

    /** Sube el archivo a Storage y lo registra en la ficha. Falla con excepción si el servidor lo rechaza. */
    suspend fun agregar(pacienteId: String, nombre: String, extension: String, bytes: ByteArray, tipoMime: String): ArchivoItem {
        val usuario = Sesion.usuarioId ?: error("No hay una sesión iniciada")
        val id = UUID.randomUUID().toString()
        val ruta = "$pacienteId/$id.${extension.lowercase()}"
        Servicios.fuente.subir(BUCKET, ruta, bytes, tipoMime)
        try {
            Servicios.fuente.crearArchivo(
                NuevoArchivoDto(
                    id = id, mascotaId = pacienteId, nombre = nombre, extension = extension.lowercase(),
                    storagePath = ruta, tamanoBytes = bytes.size.toLong(), subidoPor = usuario
                )
            )
        } catch (e: Exception) {
            runCatching { Servicios.fuente.borrar(BUCKET, listOf(ruta)) }
            throw e
        }
        val ext = extension.uppercase()
        val item = ArchivoItem(id, pacienteId, nombre, "Subido hoy · $ext", ext, iconoDe(ext), ruta)
        porPaciente.getOrPut(pacienteId) { mutableListOf() }.add(0, item)
        return item
    }

    fun renombrar(item: ArchivoItem, nuevoNombre: String) {
        val lista = porPaciente[item.pacienteId] ?: return
        val indice = lista.indexOfFirst { it.id == item.id }
        if (indice != -1) lista[indice] = item.copy(nombre = nuevoNombre)
        Servicios.escribir(alFallar = { cargar(item.pacienteId); Servicios.avisarCambio() }) {
            Servicios.fuente.renombrarArchivo(item.id, nuevoNombre)
        }
    }

    fun eliminar(item: ArchivoItem) {
        porPaciente[item.pacienteId]?.removeAll { it.id == item.id }
        Servicios.escribir(alFallar = { cargar(item.pacienteId); Servicios.avisarCambio() }) {
            Servicios.fuente.eliminarArchivo(item.id)
            Servicios.fuente.borrar(BUCKET, listOf(item.storagePath))
        }
    }

    /** Copia local del archivo (se descarga la primera vez) para abrirlo con otra aplicación. */
    suspend fun archivoLocal(item: ArchivoItem): File = Imagenes.archivoLocal(BUCKET, item.storagePath)
}
