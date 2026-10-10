package frgp.utn.edu.petcare.ui.common

import android.content.ActivityNotFoundException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import android.provider.OpenableColumns
import android.net.Uri
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Imagenes

/** Abre con la aplicación del teléfono un archivo guardado en Storage (lo baja la primera vez). */
object ArchivosUi {

    private fun mimeDe(extension: String): String = when (extension.lowercase()) {
        "pdf" -> "application/pdf"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        "doc" -> "application/msword"
        "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else -> "*/*"
    }

    private val TIPOS_ADMITIDOS = mapOf(
        "pdf" to "application/pdf",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "png" to "image/png",
        "webp" to "image/webp",
        "doc" to "application/msword",
        "docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    /** El servidor acepta archivos de hasta 15 MB. */
    private const val TAMANO_MAXIMO = 15L * 1024 * 1024

    class ArchivoElegido(val nombre: String, val extension: String, val mime: String, val bytes: ByteArray)

    private fun nombreDe(contexto: Context, uri: Uri): String? {
        var resultado: String? = null
        if (uri.scheme == "content") {
            contexto.contentResolver.query(uri, null, null, null, null)?.use {
                if (it.moveToFirst()) {
                    val indice = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (indice >= 0) resultado = it.getString(indice)
                }
            }
        }
        return resultado ?: uri.path?.substringAfterLast('/')
    }

    /**
     * Lee el archivo que eligió el usuario y comprueba que el servidor lo va a aceptar (tipo y tamaño). Si no,
     * avisa qué pasó y devuelve null.
     */
    suspend fun leer(contexto: Context, uri: Uri): ArchivoElegido? {
        val nombre = nombreDe(contexto, uri) ?: "Documento"
        val extension = nombre.substringAfterLast('.', "").lowercase()
        val mime = TIPOS_ADMITIDOS[extension]
        if (mime == null) {
            Avisos.aviso(contexto, "Formato no admitido. Subí un PDF, una imagen o un documento de Word.")
            return null
        }
        val bytes = try {
            withContext(Dispatchers.IO) { contexto.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
        } catch (e: Exception) {
            null
        }
        if (bytes == null) {
            Avisos.error(contexto, "No se pudo leer el archivo elegido.")
            return null
        }
        if (bytes.size > TAMANO_MAXIMO) {
            Avisos.aviso(contexto, "El archivo supera los 15 MB")
            return null
        }
        return ArchivoElegido(nombre, extension, mime, bytes)
    }

    suspend fun abrir(contexto: Context, bucket: String, ruta: String, extension: String) {
        try {
            val archivo = Imagenes.archivoLocal(bucket, ruta)
            val uri = FileProvider.getUriForFile(contexto, "${contexto.packageName}.fileprovider", archivo)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeDe(extension))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            contexto.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            Avisos.aviso(contexto, "No hay una aplicación para abrir este tipo de archivo")
        } catch (e: Exception) {
            Avisos.error(contexto, Errores.mensaje(e))
        }
    }
}
