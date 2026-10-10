package frgp.utn.edu.petcare.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
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

    /** Fotos ya decodificadas, para que al volver a una pantalla aparezcan sin volver a leer el archivo. */
    private val memoria = object : LruCache<String, Bitmap>((Runtime.getRuntime().maxMemory() / 1024 / 8).toInt()) {
        override fun sizeOf(clave: String, valor: Bitmap) = valor.byteCount / 1024
    }

    /** Lado máximo al que se achican las fotos para mostrarlas en listas y fichas. */
    private const val LADO_PANTALLA = 720

    /**
     * Muestra una foto en [vista]: primero la elegida en este teléfono ([local]); si no hay, la del servidor
     * ([ruta]). La imagen se decodifica fuera del hilo principal para no trabar la pantalla. [alResolver] avisa
     * si había una imagen para mostrar (para elegir entre foto e inicial).
     */
    fun mostrar(
        vista: ImageView,
        local: Uri?,
        ruta: String?,
        bucket: String = BUCKET_FOTOS,
        alResolver: ((Boolean) -> Unit)? = null
    ) {
        val etiqueta = ruta ?: local?.toString()
        vista.setTag(R.id.tag_imagen, etiqueta)
        if (local != null) {
            ponerImagen(vista, etiqueta, "uri:$local") { decodificarUri(local) }
            alResolver?.invoke(true)
            return
        }
        if (ruta.isNullOrBlank()) {
            alResolver?.invoke(false)
            return
        }
        val enCache = archivoDeCache(bucket, ruta)
        if (enCache.exists() && enCache.length() > 0) {
            ponerImagen(vista, etiqueta, enCache.absolutePath) { decodificarArchivo(enCache) }
            alResolver?.invoke(true)
            return
        }
        alResolver?.invoke(false)
        Servicios.scope.launch {
            val archivo = runCatching { archivoLocal(bucket, ruta) }.getOrNull() ?: return@launch
            if (vista.getTag(R.id.tag_imagen) == etiqueta) {
                ponerImagen(vista, etiqueta, archivo.absolutePath) { decodificarArchivo(archivo) }
                alResolver?.invoke(true)
            }
        }
    }

    private fun ponerImagen(vista: ImageView, etiqueta: String?, clave: String, decodificar: () -> Bitmap?) {
        memoria.get(clave)?.let {
            vista.setImageBitmap(it)
            return
        }
        Servicios.scope.launch {
            val bitmap = withContext(Dispatchers.IO) { runCatching(decodificar).getOrNull() } ?: return@launch
            memoria.put(clave, bitmap)
            if (vista.getTag(R.id.tag_imagen) == etiqueta) vista.setImageBitmap(bitmap)
        }
    }

    private fun opcionesDeMuestreo(ancho: Int, alto: Int): BitmapFactory.Options {
        var muestreo = 1
        while (maxOf(ancho, alto) / (muestreo * 2) >= LADO_PANTALLA) muestreo *= 2
        return BitmapFactory.Options().apply { inSampleSize = muestreo }
    }

    private fun decodificarArchivo(archivo: File): Bitmap? {
        val medidas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(archivo.absolutePath, medidas)
        return BitmapFactory.decodeFile(archivo.absolutePath, opcionesDeMuestreo(medidas.outWidth, medidas.outHeight))
    }

    private fun decodificarUri(uri: Uri): Bitmap? {
        val ctx = contexto ?: return null
        val medidas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, medidas) }
        return ctx.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, opcionesDeMuestreo(medidas.outWidth, medidas.outHeight))
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
        memoria.evictAll()
    }

    fun limpiarCache() {
        memoria.evictAll()
        runCatching { carpeta().deleteRecursively() }
    }
}
