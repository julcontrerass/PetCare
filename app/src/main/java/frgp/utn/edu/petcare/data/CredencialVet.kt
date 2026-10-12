package frgp.utn.edu.petcare.data

import android.net.Uri
import java.io.File
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Foto del carnet o de la matrícula con la que el administrador verifica a un veterinario. Va al bucket privado
 * `credenciales`, en la carpeta del propio usuario, y solo la ve el administrador.
 */
object CredencialVet {

    const val BUCKET = "credenciales"

    /** Sube la foto elegida y devuelve su ruta en el bucket; todavía no queda registrada en el perfil. */
    suspend fun subirArchivo(archivo: File, usuarioId: String): String {
        val ruta = "$usuarioId/${UUID.randomUUID()}.jpg"
        val bytes = withContext(Dispatchers.IO) { archivo.readBytes() }
        Servicios.fuente.subir(BUCKET, ruta, bytes, "image/jpeg")
        return ruta
    }

    /** Achica la imagen elegida, la sube y la deja registrada en el perfil del veterinario. */
    suspend fun subir(uri: Uri, usuarioId: String): String {
        val archivo = Imagenes.prepararFoto(uri)
        val ruta = subirArchivo(archivo, usuarioId)
        Servicios.fuente.guardarCredencial(ruta)
        runCatching { archivo.delete() }
        return ruta
    }
}
