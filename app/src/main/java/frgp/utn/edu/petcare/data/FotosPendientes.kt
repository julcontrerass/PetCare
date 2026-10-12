package frgp.utn.edu.petcare.data

import android.content.Context
import android.net.Uri
import java.io.File
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Las fotos que se eligen durante el registro no se pueden subir hasta que hay una sesión abierta, y si el
 * proyecto pide confirmar el correo eso pasa recién en el primer ingreso. Hasta entonces quedan guardadas en el
 * teléfono y se suben solas la primera vez que la cuenta puede usar la app.
 */
object FotosPendientes {

    private const val ARCHIVO = "petcare_pendientes"

    private fun preferencias() =
        Servicios.contextoApp?.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE)

    /** [mascotas] son pares nombre de la mascota a ruta de su foto en el teléfono. */
    fun guardar(email: String, fotoPerfil: String?, mascotas: List<Pair<String, String>>) {
        if (fotoPerfil == null && mascotas.isEmpty()) return
        val datos = buildJsonObject {
            fotoPerfil?.let { put("perfil", it) }
            put("mascotas", JsonArray(mascotas.map { (nombre, ruta) -> buildJsonObject { put("nombre", nombre); put("ruta", ruta) } }))
        }
        preferencias()?.edit()?.putString(email.lowercase(), datos.toString())?.apply()
    }

    /**
     * La foto del carnet se guarda aparte de las otras: se puede subir aunque la cuenta todavía esté en revisión
     * (el bucket `credenciales` no pide cuenta activa), y es justamente lo que el administrador necesita para revisarla.
     */
    fun guardarCredencial(email: String, ruta: String) {
        preferencias()?.edit()?.putString(email.lowercase() + "#credencial", ruta)?.apply()
    }

    /** Sube el carnet pendiente de [email], si hay. Devuelve true si quedó cargado. */
    suspend fun subirCredencial(email: String, usuarioId: String): Boolean {
        val prefs = preferencias() ?: return false
        val clave = email.lowercase() + "#credencial"
        val ruta = prefs.getString(clave, null) ?: return false
        val archivo = File(ruta)
        if (!archivo.exists()) {
            prefs.edit().remove(clave).apply()
            return false
        }
        return runCatching {
            val preparada = Imagenes.prepararFoto(Uri.fromFile(archivo))
            val subida = CredencialVet.subirArchivo(preparada, usuarioId)
            Servicios.fuente.guardarCredencial(subida)
            preparada.delete()
            archivo.delete()
            prefs.edit().remove(clave).apply()
        }.isSuccess
    }

    /** Sube lo que haya pendiente para [email]. Devuelve true si cambió la foto del perfil. */
    suspend fun subir(email: String, usuarioId: String): Boolean {
        val prefs = preferencias() ?: return false
        val clave = email.lowercase()
        val texto = prefs.getString(clave, null) ?: return false
        val datos = runCatching { Json.parseToJsonElement(texto).jsonObject }.getOrNull()
        if (datos == null) {
            prefs.edit().remove(clave).apply()
            return false
        }
        var cambioElPerfil = false
        datos["perfil"]?.jsonPrimitive?.contentOrNull?.let { ruta ->
            runCatching {
                val foto = Imagenes.subirFoto(Imagenes.prepararFoto(Uri.fromFile(File(ruta))), usuarioId)
                Servicios.fuente.actualizarPerfil(buildJsonObject { put("foto_path", foto) })
                File(ruta).delete()
                cambioElPerfil = true
            }
        }
        val mascotas = datos["mascotas"]?.jsonArray.orEmpty()
        if (mascotas.isNotEmpty()) {
            runCatching {
                val creadas = Servicios.fuente.misMascotas()
                for (item in mascotas) {
                    val m = item.jsonObject
                    val nombre = m["nombre"]?.jsonPrimitive?.contentOrNull ?: continue
                    val ruta = m["ruta"]?.jsonPrimitive?.contentOrNull ?: continue
                    val creada = creadas.firstOrNull { it.nombre == nombre } ?: continue
                    val foto = Imagenes.subirFoto(Imagenes.prepararFoto(Uri.fromFile(File(ruta))), usuarioId)
                    Servicios.fuente.actualizarMascota(creada.id, buildJsonObject { put("foto_path", foto) })
                    File(ruta).delete()
                }
            }
        }
        prefs.edit().remove(clave).apply()
        return cambioElPerfil
    }
}
