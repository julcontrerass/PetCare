package frgp.utn.edu.petcare.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.widget.ImageView
import frgp.utn.edu.petcare.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/**
 * Fotos y archivos que viven en Storage. Se descargan una sola vez a la carpeta de caché del teléfono y
 * desde ahí se muestran; las fotos nuevas se achican antes de subirlas.
 */
object Imagenes {

    const val BUCKET_FOTOS = "fotos"
    private const val LADO_MAXIMO = 1280
    private const val CALIDAD_JPEG = 85

    private var contexto: Context? = null

    fun iniciar(contexto: Context) {
        this.contexto = contexto.applicationContext
    }

    private fun carpeta(): File =
        File(contexto?.cacheDir ?: error("Imagenes no está inicializado"), "storage").also { it.mkdirs() }

    private fun archivoDeCache(bucket: String, ruta: String) =
        File(carpeta(), "${bucket}_${ruta.replace('/', '_')}")

    /**
     * Muestra una foto en [vista]: primero la elegida en este teléfono ([local]); si no hay, la del servidor
     * ([ruta]). [alResolver] avisa si había una imagen para mostrar (para elegir entre foto e inicial).
     */
    fun mostrar(
        vista: ImageView,
        local: Uri?,
        ruta: String?,
        bucket: String = BUCKET_FOTOS,
        alResolver: ((Boolean) -> Unit)? = null
    ) {
        vista.setTag(R.id.tag_imagen, ruta ?: local?.toString())
        if (local != null) {
            vista.setImageURI(local)
            alResolver?.invoke(true)
            return
        }
        if (ruta.isNullOrBlank()) {
            alResolver?.invoke(false)
            return
        }
        val enCache = archivoDeCache(bucket, ruta)
        if (enCache.exists()) {
            vista.setImageURI(Uri.fromFile(enCache))
            alResolver?.invoke(true)
            return
        }
        alResolver?.invoke(false)
        Servicios.scope.launch {
            val archivo = runCatching { archivoLocal(bucket, ruta) }.getOrNull() ?: return@launch
            if (vista.getTag(R.id.tag_imagen) == ruta) {
                vista.setImageURI(Uri.fromFile(archivo))
                alResolver?.invoke(true)
            }
        }
    }

    /** Descarga el archivo si todavía no está en el teléfono y devuelve su copia local. */
    suspend fun archivoLocal(bucket: String, ruta: String): File {
        val destino = archivoDeCache(bucket, ruta)
        if (destino.exists() && destino.length() > 0) return destino
        val bytes = Servicios.fuente.descargar(bucket, ruta)
        withContext(Dispatchers.IO) { destino.writeBytes(bytes) }
        return destino
    }

    /** Achica y comprime la foto elegida; devuelve un JPEG listo para subir. */
    suspend fun prepararFoto(uri: Uri): File = withContext(Dispatchers.IO) {
        val ctx = contexto ?: error("Imagenes no está inicializado")
        val bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(ctx.contentResolver, uri)) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            val mayor = maxOf(info.size.width, info.size.height)
            if (mayor > LADO_MAXIMO) {
                val escala = LADO_MAXIMO.toFloat() / mayor
                decoder.setTargetSize((info.size.width * escala).toInt(), (info.size.height * escala).toInt())
            }
        }
        val archivo = File(carpeta(), "subida_${UUID.randomUUID()}.jpg")
        archivo.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, CALIDAD_JPEG, it) }
        archivo
    }

    /**
     * Sube una foto ya preparada al bucket `fotos` en la carpeta del usuario y devuelve su ruta.
     * La copia queda en caché para no volver a bajarla.
     */
    suspend fun subirFoto(archivo: File, usuarioId: String): String {
        val ruta = "$usuarioId/${UUID.randomUUID()}.jpg"
        val bytes = withContext(Dispatchers.IO) { archivo.readBytes() }
        Servicios.fuente.subir(BUCKET_FOTOS, ruta, bytes, "image/jpeg")
        withContext(Dispatchers.IO) { archivo.copyTo(archivoDeCache(BUCKET_FOTOS, ruta), overwrite = true) }
        return ruta
    }

    /** Borra del servidor una foto que ya no se usa (no falla si no existía). */
    suspend fun borrarFoto(ruta: String?) {
        if (ruta.isNullOrBlank()) return
        runCatching { Servicios.fuente.borrar(BUCKET_FOTOS, listOf(ruta)) }
        runCatching { archivoDeCache(BUCKET_FOTOS, ruta).delete() }
    }

    fun limpiarCache() {
        runCatching { carpeta().deleteRecursively() }
    }
}
