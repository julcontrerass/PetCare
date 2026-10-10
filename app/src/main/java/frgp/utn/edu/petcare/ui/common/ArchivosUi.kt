package frgp.utn.edu.petcare.ui.common

import android.content.ActivityNotFoundException
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
