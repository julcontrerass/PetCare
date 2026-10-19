package frgp.utn.edu.petcare.data.repositorio

import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.NuevoRecordatorioDto
import frgp.utn.edu.petcare.data.remoto.RecordatorioDto
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Un recordatorio hecho a mano. [creadoPor] distingue los propios de los que dejó el veterinario. */
class RecordatorioManual(
    val id: String,
    val mascotaId: String,
    var titulo: String,
    var tipo: String,
    var fecha: LocalDate,
    /** "HH:mm" o null si es para todo el día. */
    var hora: String?,
    var nota: String,
    val creadoPor: String
) {
    val esMio: Boolean get() = creadoPor == Sesion.usuarioId
}

/**
 * Recordatorios que crea el propio usuario (el dueño para su mascota, el veterinario para un paciente). El dueño
 * también ve los que le deja su veterinario, pero solo los puede editar quien los creó.
 */
object RecordatoriosRepo {

    val TIPOS = listOf("Vacuna", "Control", "Medicación", "Higiene", "Otro")

    private var items = mutableListOf<RecordatorioManual>()

    /** Todos, el más próximo primero. */
    val lista: List<RecordatorioManual> get() = items.sortedWith(compareBy({ it.fecha }, { it.hora.orEmpty() }))

    fun deMascota(mascotaId: String): List<RecordatorioManual> = lista.filter { it.mascotaId == mascotaId }

    fun limpiar() = items.clear()

    private fun aModelo(d: RecordatorioDto) = RecordatorioManual(
        id = d.id, mascotaId = d.mascotaId, titulo = d.titulo, tipo = d.tipo.replaceFirstChar { it.uppercase() },
        fecha = Fechas.iso(d.fecha) ?: LocalDate.now(), hora = d.hora?.take(5), nota = d.nota.orEmpty(),
        creadoPor = d.creadoPor
    )

    suspend fun cargar() {
        items = Servicios.fuente.recordatorios().map(::aModelo).toMutableList()
    }

    private suspend fun recargar() {
        runCatching { cargar() }
        Servicios.avisarCambio()
    }

    fun crear(mascotaId: String, titulo: String, tipo: String, fecha: LocalDate, hora: String?, nota: String): RecordatorioManual {
        val id = UUID.randomUUID().toString()
        val usuario = Sesion.usuarioId ?: error("No hay una sesión iniciada")
        val nuevo = RecordatorioManual(id, mascotaId, titulo, tipo, fecha, hora, nota, usuario)
        items.add(nuevo)
        Servicios.escribir(alFallar = { recargar() }) {
            Servicios.fuente.crearRecordatorio(
                NuevoRecordatorioDto(
                    id = id, mascotaId = mascotaId, creadoPor = usuario, titulo = titulo, tipo = tipo.lowercase(),
                    fecha = fecha.toString(), hora = hora?.let { "$it:00" }, nota = nota.ifBlank { null }
                )
            )
        }
        return nuevo
    }

    fun editar(r: RecordatorioManual, titulo: String, tipo: String, fecha: LocalDate, hora: String?, nota: String) {
        if (!r.esMio) return
        r.titulo = titulo
        r.tipo = tipo
        r.fecha = fecha
        r.hora = hora
        r.nota = nota
        Servicios.escribir(alFallar = { recargar() }) {
            Servicios.fuente.actualizarRecordatorio(r.id, buildJsonObject {
                put("titulo", titulo)
                put("tipo", tipo.lowercase())
                put("fecha", fecha.toString())
                put("hora", hora?.let { "$it:00" })
                put("nota", nota.ifBlank { null })
            })
        }
    }

    fun borrar(r: RecordatorioManual) {
        if (!r.esMio) return
        items.remove(r)
        Servicios.escribir(alFallar = { recargar() }) { Servicios.fuente.borrarRecordatorio(r.id) }
    }
}
