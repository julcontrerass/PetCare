package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.NuevoRegistroSaludDto
import frgp.utn.edu.petcare.data.remoto.RegistroSaludDto
import java.time.LocalDate
import java.util.UUID

enum class TipoRegistro(val etiqueta: String, val clave: String) {
    VACUNA("Vacunas", "vacuna"),
    TRATAMIENTO("Tratamientos", "tratamiento"),
    DOCUMENTO("Documentos", "documento")
}

data class RegistroSalud(
    val id: String,
    val tipo: TipoRegistro,
    val mascotaId: String,
    val mascota: String,
    val titulo: String,
    val detalle: String,
    val fecha: String,
    val estado: String? = null,
    val archivoPath: String? = null
)

/** Vacunas, tratamientos y documentos de las mascotas que ve el veterinario en sesión. */
object SaludRepo {

    private const val DIAS_PARA_AVISAR = 30

    val registros: MutableList<RegistroSalud> = mutableListOf()

    fun limpiar() = registros.clear()

    suspend fun cargar() {
        val nuevos = Servicios.fuente.registrosSalud().map(::aRegistro)
        registros.clear()
        registros.addAll(nuevos)
    }

    /** Nombre de la mascota para mostrar: la del paciente del veterinario o la del dueño en sesión. */
    private fun nombreDe(mascotaId: String): String =
        PacientesRepo.porId(mascotaId)?.nombre
            ?: DuenoRepo.mascotas.firstOrNull { it.id == mascotaId }?.nombre
            ?: "Mascota"

    /**
     * Carga el carnet del dueño: lo que cargó él o el veterinario en vacunas, tratamientos y documentos, más los
     * archivos que el veterinario adjuntó a las consultas (que se muestran en Documentos).
     */
    suspend fun cargarComoDueno() {
        val f = Servicios.fuente
        val propios = f.registrosSalud().map(::aRegistro)
        val adjuntos = DuenoRepo.mascotas.flatMap { m ->
            runCatching { f.archivosDe(m.id) }.getOrDefault(emptyList()).map { a ->
                RegistroSalud(
                    id = PREFIJO_ARCHIVO + a.id, tipo = TipoRegistro.DOCUMENTO, mascotaId = a.mascotaId,
                    mascota = m.nombre, titulo = a.nombre,
                    detalle = a.extension.uppercase() + if (a.turnoId != null) " · adjunto a una consulta" else "",
                    fecha = Fechas.corta(Fechas.instante(a.createdAt).toLocalDate()), archivoPath = a.storagePath
                )
            }
        }
        registros.clear()
        registros.addAll((propios + adjuntos))
    }

    private const val PREFIJO_ARCHIVO = "archivo:"

    private fun aRegistro(r: RegistroSaludDto): RegistroSalud {
        val tipo = TipoRegistro.entries.firstOrNull { it.clave == r.tipo } ?: TipoRegistro.DOCUMENTO
        val fecha = LocalDate.parse(r.fecha)
        val proxima = r.proximaDosis?.let { LocalDate.parse(it) }
        val fin = r.fechaFin?.let { LocalDate.parse(it) }
        val hoy = LocalDate.now()
        val (detalle, textoFecha, estado) = when (tipo) {
            TipoRegistro.VACUNA -> Triple(
                proxima?.let { "Próxima dosis: ${Fechas.corta(it)}" } ?: "Sin próxima dosis",
                Fechas.corta(fecha),
                when {
                    proxima == null -> "Al día"
                    proxima.isBefore(hoy) -> "Vencida"
                    !proxima.isAfter(hoy.plusDays(DIAS_PARA_AVISAR.toLong())) -> "Próxima"
                    else -> "Al día"
                }
            )
            TipoRegistro.TRATAMIENTO -> Triple(
                r.detalle?.takeIf { it.isNotBlank() } ?: "Sin indicaciones",
                if (fin != null) "${Fechas.corta(fecha)} - ${Fechas.corta(fin)}" else "Desde ${Fechas.corta(fecha)}",
                if (fin != null && fin.isBefore(hoy)) "Finalizado" else "Activo"
            )
            TipoRegistro.DOCUMENTO -> Triple(r.detalle?.takeIf { it.isNotBlank() } ?: "Documento", Fechas.corta(fecha), null)
        }
        return RegistroSalud(
            id = r.id, tipo = tipo, mascotaId = r.mascotaId, mascota = nombreDe(r.mascotaId),
            titulo = r.titulo, detalle = detalle, fecha = textoFecha, estado = estado, archivoPath = r.archivoPath
        )
    }

    fun filtrar(tipo: TipoRegistro, consulta: String, mascotaId: String?): List<RegistroSalud> {
        val q = consulta.trim().lowercase()
        return registros.filter { r ->
            r.tipo == tipo &&
                (mascotaId == null || r.mascotaId == mascotaId) &&
                (q.isEmpty() ||
                    r.titulo.lowercase().contains(q) ||
                    r.detalle.lowercase().contains(q) ||
                    r.mascota.lowercase().contains(q))
        }
    }

    /**
     * Agrega un registro. [fechaFin] es el cierre de un tratamiento, [proximaDosis] la siguiente vacuna y
     * [archivoPath] el documento ya subido a Storage.
     */
    fun agregar(
        tipo: TipoRegistro, mascotaId: String, titulo: String, detalle: String?, fecha: LocalDate,
        fechaFin: LocalDate? = null, proximaDosis: LocalDate? = null, archivoPath: String? = null
    ): RegistroSalud {
        val id = UUID.randomUUID().toString()
        val dto = RegistroSaludDto(
            id = id, mascotaId = mascotaId, tipo = tipo.clave, titulo = titulo, detalle = detalle,
            fecha = fecha.toString(), fechaFin = fechaFin?.toString(), proximaDosis = proximaDosis?.toString(),
            archivoPath = archivoPath
        )
        val registro = aRegistro(dto)
        registros.add(0, registro)
        Servicios.escribir(alFallar = { recargar(); Servicios.avisarCambio() }) {
            Servicios.fuente.crearRegistroSalud(
                NuevoRegistroSaludDto(
                    id = id, mascotaId = mascotaId, tipo = tipo.clave, titulo = titulo, detalle = detalle,
                    fecha = fecha.toString(), fechaFin = fechaFin?.toString(), proximaDosis = proximaDosis?.toString(),
                    archivoPath = archivoPath, creadoPor = Sesion.usuarioId ?: error("No hay una sesión iniciada")
                )
            )
        }
        return registro
    }

    fun eliminar(registro: RegistroSalud) {
        registros.remove(registro)
        val esArchivo = registro.id.startsWith(PREFIJO_ARCHIVO)
        Servicios.escribir(alFallar = { recargar(); Servicios.avisarCambio() }) {
            if (esArchivo) Servicios.fuente.eliminarArchivo(registro.id.removePrefix(PREFIJO_ARCHIVO))
            else Servicios.fuente.eliminarRegistroSalud(registro.id)
            registro.archivoPath?.let { Servicios.fuente.borrar("archivos", listOf(it)) }
        }
    }

    /** Vuelve a pedir el carnet según quién tiene la sesión. */
    private suspend fun recargar() {
        if (Sesion.rol == Sesion.Rol.DUENO) cargarComoDueno() else cargar()
    }
}
