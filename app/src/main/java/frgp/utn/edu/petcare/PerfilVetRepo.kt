package frgp.utn.edu.petcare

import android.net.Uri
import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.put

/** Perfil del veterinario en sesión. */
object PerfilVetRepo {
    var nombre = ""
    var dni = ""
    var matricula = ""
    var clinica = ""
    var direccionClinica = ""
    var telefono = ""
    var email = ""
    var fotoPath: String? = null
    /** Foto elegida en este teléfono; se muestra mientras se sube. */
    var fotoUri: Uri? = null

    // Días y horarios
    val todosLosDias = arrayOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
    val diasSeleccionados = BooleanArray(7)
    var horaApertura = "09:00"
    var horaCierre = "18:00"

    fun textoHorarios(): String {
        val diasActivos = todosLosDias.filterIndexed { index, _ -> diasSeleccionados[index] }
        return if (diasActivos.isEmpty()) {
            "Sin días de atención configurados"
        } else {
            val diasStr = diasActivos.joinToString(", ")
            "$diasStr · $horaApertura a $horaCierre hs"
        }
    }

    // Especialidades y prácticas
    val todasLasEspecialidades: Array<String> = CatalogoMedico.TODAS.toTypedArray()
    val especialidadesSeleccionadas = BooleanArray(todasLasEspecialidades.size)

    fun textoEspecialidades(): String {
        val activas = todasLasEspecialidades.filterIndexed { index, _ -> especialidadesSeleccionadas[index] }
        return if (activas.isEmpty()) {
            "Sin especialidades seleccionadas"
        } else {
            activas.joinToString(", ")
        }
    }

    /** Avisos que el veterinario quiere recibir; lo que no está cargado se considera activado. */
    val preferencias: MutableMap<String, Boolean> = mutableMapOf()

    fun preferencia(clave: String) = preferencias[clave] ?: true

    fun guardarPreferencias() {
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            Servicios.fuente.actualizarPerfil(buildJsonObject {
                put("preferencias", buildJsonObject { preferencias.forEach { (clave, valor) -> put(clave, valor) } })
            })
        }
    }

    fun limpiar() {
        preferencias.clear()
        nombre = ""; dni = ""; matricula = ""; clinica = ""; direccionClinica = ""; telefono = ""; email = ""
        fotoPath = null; fotoUri = null
        diasSeleccionados.fill(false)
        especialidadesSeleccionadas.fill(false)
        horaApertura = "09:00"; horaCierre = "18:00"
    }

    /** Copia al repositorio lo que dice el servidor sobre el veterinario en sesión. */
    fun cargar(p: PerfilDto) {
        val v = p.veterinarios
        nombre = p.nombre
        email = p.email
        telefono = p.telefono.orEmpty()
        dni = p.privados?.dni.orEmpty()
        fotoPath = p.fotoPath
        matricula = v?.matricula.orEmpty()
        clinica = v?.clinica.orEmpty()
        direccionClinica = v?.direccionClinica.orEmpty()
        preferencias.clear()
        p.preferencias?.forEach { (clave, valor) ->
            (valor as? JsonPrimitive)?.booleanOrNull?.let { preferencias[clave] = it }
        }
        diasSeleccionados.fill(false)
        v?.diasAtencion?.forEach { if (it in 1..7) diasSeleccionados[it - 1] = true }
        horaApertura = (v?.horaApertura ?: "09:00").take(5)
        horaCierre = (v?.horaCierre ?: "18:00").take(5)
        especialidadesSeleccionadas.fill(false)
        v?.especialidades?.forEach { esp ->
            val i = todasLasEspecialidades.indexOf(esp)
            if (i >= 0) especialidadesSeleccionadas[i] = true
        }
    }

    /** Guarda los datos personales y de la clínica; se muestran ya y se mandan al servidor en segundo plano. */
    fun guardarDatos() {
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            Servicios.fuente.actualizarPerfil(buildJsonObject {
                put("nombre", nombre)
                put("telefono", telefono.ifBlank { null })
            })
            Servicios.fuente.actualizarVeterinario(buildJsonObject {
                put("matricula", matricula)
                put("clinica", clinica.ifBlank { null })
                put("direccion_clinica", direccionClinica.ifBlank { null })
            })
        }
    }

    fun guardarHorarios() {
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            Servicios.fuente.actualizarVeterinario(buildJsonObject {
                put("dias_atencion", buildJsonArray {
                    diasSeleccionados.forEachIndexed { i, activo -> if (activo) add(i + 1) }
                })
                put("hora_apertura", "$horaApertura:00")
                put("hora_cierre", "$horaCierre:00")
            })
        }
    }

    fun guardarEspecialidades() {
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            Servicios.fuente.actualizarVeterinario(buildJsonObject {
                put("especialidades", buildJsonArray {
                    todasLasEspecialidades.forEachIndexed { i, nombre -> if (especialidadesSeleccionadas[i]) add(nombre) }
                })
            })
        }
    }

    fun cambiarFoto(uri: Uri) {
        val anterior = fotoPath
        fotoUri = uri
        Servicios.escribir {
            val usuario = Sesion.usuarioId ?: return@escribir
            val ruta = Imagenes.subirFoto(Imagenes.prepararFoto(uri), usuario)
            Servicios.fuente.actualizarPerfil(buildJsonObject { put("foto_path", ruta) })
            fotoPath = ruta
            Imagenes.borrarFoto(anterior)
        }
    }
}
