package frgp.utn.edu.petcare.data.repositorio

import android.net.Uri
import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.remoto.NuevaSedeDto
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.model.SedeVet
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.ui.common.Documentos
import java.util.UUID
import kotlinx.serialization.json.add
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.JsonPrimitive
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

    // Días y horarios del lugar principal (los demás lugares están en [sedes])
    val todosLosDias = arrayOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
    val diasSeleccionados = BooleanArray(7)
    var horaApertura = "09:00"
    var horaCierre = "18:00"

    /** Lugares donde atiende, el principal primero; cada uno tiene sus propios días y horarios. */
    val sedes: MutableList<SedeVet> = mutableListOf()

    /** Cuántos lugares puede tener como máximo (el servidor aplica el mismo tope). */
    const val MAX_SEDES = 3

    /** El lugar con ese id; si no se indica (o ya no existe) el principal. */
    fun sede(id: String?): SedeVet? = sedes.firstOrNull { it.id == id } ?: sedes.firstOrNull()

    /** Lo "de siempre" (clínica, dirección, días y horario) refleja el lugar principal. */
    private fun reflejarPrincipal() {
        val principal = sedes.firstOrNull() ?: return
        clinica = principal.nombre
        direccionClinica = principal.direccion
        diasSeleccionados.fill(false)
        principal.dias.forEach { if (it in 1..7) diasSeleccionados[it - 1] = true }
        horaApertura = principal.apertura
        horaCierre = principal.cierre
    }

    private fun sedeNueva(id: String, sede: SedeVet) = NuevaSedeDto(
        id = id, veterinarioId = Sesion.usuarioId.orEmpty(), nombre = sede.nombre,
        direccion = sede.direccion.ifBlank { null }, diasAtencion = sede.dias.sorted(),
        horaApertura = "${sede.apertura}:00", horaCierre = "${sede.cierre}:00"
    )

    fun agregarSede(sede: SedeVet): SedeVet? {
        if (sedes.size >= MAX_SEDES) return null
        val nueva = sede.copy(id = UUID.randomUUID().toString())
        sedes.add(nueva)
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            Servicios.fuente.crearSede(sedeNueva(nueva.id, nueva))
        }
        return nueva
    }

    fun guardarSede(sede: SedeVet) {
        val i = sedes.indexOfFirst { it.id == sede.id }
        if (i < 0) return
        sedes[i] = sede
        if (i == 0) reflejarPrincipal()
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            if (sede.id.isBlank()) {
                // Todavía sin lugares propios en el servidor: se guardan los datos "de siempre" del veterinario
                Servicios.fuente.actualizarVeterinario(buildJsonObject {
                    put("clinica", sede.nombre)
                    put("direccion_clinica", sede.direccion.ifBlank { null })
                    put("dias_atencion", buildJsonArray { sede.dias.sorted().forEach { add(it) } })
                    put("hora_apertura", "${sede.apertura}:00")
                    put("hora_cierre", "${sede.cierre}:00")
                })
            } else {
                Servicios.fuente.actualizarSede(sede.id, buildJsonObject {
                    put("nombre", sede.nombre)
                    put("direccion", sede.direccion.ifBlank { null })
                    put("dias_atencion", buildJsonArray { sede.dias.sorted().forEach { add(it) } })
                    put("hora_apertura", "${sede.apertura}:00")
                    put("hora_cierre", "${sede.cierre}:00")
                })
            }
        }
    }

    /** Quita un lugar. El servidor no deja borrar el único ni uno que todavía tiene turnos pendientes. */
    fun eliminarSede(id: String) {
        if (sedes.size <= 1) return
        sedes.removeAll { it.id == id }
        reflejarPrincipal()
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) { Servicios.fuente.eliminarSede(id) }
    }

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

    // Tipos de animal que atiende
    val tiposAnimales: MutableSet<String> = linkedSetOf()

    /** True si atiende mascotas de ese tipo (lo que no tiene nombre propio cuenta como "Otro"). */
    fun atiende(tipoMascota: String?): Boolean = TiposMascota.normalizar(tipoMascota) in tiposAnimales

    fun textoTiposAnimales(): String {
        val activos = TiposMascota.TODOS.filter { it in tiposAnimales }
        return if (activos.isEmpty()) "Sin tipos de animales seleccionados"
        else activos.joinToString(", ") { TiposMascota.plural(it) }
    }

    // Minutos que dura cada servicio; lo que no está cargado usa la duración por defecto del catálogo
    val duraciones: MutableMap<String, Int> = mutableMapOf()

    fun duracionDe(servicio: String?): Int =
        duraciones.entries.firstOrNull { it.key.equals(servicio?.trim(), ignoreCase = true) }?.value
            ?.coerceIn(CatalogoMedico.DURACION_MINIMA_MIN, CatalogoMedico.DURACION_MAXIMA_MIN)
            ?: CatalogoMedico.duracionPorDefecto(servicio)

    /** Servicios y especialidades que el veterinario marcó como propios. */
    fun serviciosOfrecidos(): List<String> =
        todasLasEspecialidades.filterIndexed { index, _ -> especialidadesSeleccionadas[index] }

    fun textoDuraciones(): String {
        val servicios = serviciosOfrecidos()
        if (servicios.isEmpty()) return "Primero elegí tus especialidades y prácticas"
        val minutos = servicios.map { duracionDe(it) }
        val corto = CatalogoMedico.textoDuracion(minutos.min())
        val largo = CatalogoMedico.textoDuracion(minutos.max())
        val cantidad = if (servicios.size == 1) "1 servicio" else "${servicios.size} servicios"
        return if (corto == largo) "$cantidad · $corto cada uno" else "$cantidad · de $corto a $largo"
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
        sedes.clear()
        especialidadesSeleccionadas.fill(false)
        tiposAnimales.clear()
        duraciones.clear()
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
        sedes.clear()
        v?.lugares()?.forEach {
            sedes.add(
                SedeVet(
                    id = it.id, nombre = it.nombre, direccion = it.direccion.orEmpty(), dias = it.diasAtencion.toSet(),
                    apertura = it.horaApertura.take(5), cierre = it.horaCierre.take(5)
                )
            )
        }
        reflejarPrincipal()
        especialidadesSeleccionadas.fill(false)
        v?.especialidades?.forEach { esp ->
            val i = todasLasEspecialidades.indexOf(esp)
            if (i >= 0) especialidadesSeleccionadas[i] = true
        }
        tiposAnimales.clear()
        (v?.tiposAnimales ?: TiposMascota.TODOS).forEach { tiposAnimales.add(TiposMascota.normalizar(it)) }
        duraciones.clear()
        v?.duraciones?.let { duraciones.putAll(it) }
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

    /** Los datos con los que se firman las recetas y los certificados. */
    fun comoProfesional(sedeId: String? = null): Documentos.Profesional {
        // El encabezado lleva el lugar donde fue el turno; sin turno (o sin lugar) el principal
        val lugar = sede(sedeId)?.takeIf { it.nombre.isNotBlank() }
        return Documentos.Profesional(
            nombre, matricula, lugar?.nombre ?: clinica, lugar?.direccion ?: direccionClinica, telefono
        )
    }

    fun guardarTiposAnimales() {
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            Servicios.fuente.actualizarVeterinario(buildJsonObject {
                put("tipos_animales", buildJsonArray { TiposMascota.TODOS.filter { it in tiposAnimales }.forEach { add(it) } })
            })
        }
    }

    fun guardarDuraciones() {
        Servicios.escribir(alFallar = { Sesion.recargarPerfil() }) {
            Servicios.fuente.actualizarVeterinario(buildJsonObject {
                put("duraciones", buildJsonObject { duraciones.forEach { (servicio, minutos) -> put(servicio, minutos) } })
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
