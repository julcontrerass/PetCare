package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.NuevoInformeDto
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

data class InformeData(
    val pacienteId: String,
    val id: String? = null,
    var motivo: String = "",
    var diagnostico: String = "",
    var tratamiento: String = ""
)

/** Informe clínico que el veterinario en sesión escribe sobre cada paciente. */
object InformesRepo {

    private val informes = mutableMapOf<String, InformeData>()

    fun limpiar() = informes.clear()

    /** Trae del servidor el último informe propio del paciente (si ya escribió alguno). */
    suspend fun cargar(pacienteId: String): InformeData {
        val miId = Sesion.usuarioId
        val propio = Servicios.fuente.informesDe(pacienteId).firstOrNull { it.veterinarioId == miId }
        val informe = if (propio == null) InformeData(pacienteId) else InformeData(
            pacienteId, propio.id, propio.motivo.orEmpty(), propio.diagnostico.orEmpty(), propio.tratamiento.orEmpty()
        )
        informes[pacienteId] = informe
        return informe
    }

    fun obtener(pacienteId: String): InformeData = informes[pacienteId] ?: InformeData(pacienteId)

    fun guardar(pacienteId: String, motivo: String, diagnostico: String, tratamiento: String, turnoId: String? = null) {
        val existente = informes[pacienteId]?.id
        val id = existente ?: UUID.randomUUID().toString()
        informes[pacienteId] = InformeData(pacienteId, id, motivo, diagnostico, tratamiento)
        Servicios.escribir(alFallar = { cargar(pacienteId) }) {
            if (existente != null) {
                Servicios.fuente.actualizarInforme(existente, buildJsonObject {
                    put("motivo", motivo.ifBlank { null })
                    put("diagnostico", diagnostico.ifBlank { null })
                    put("tratamiento", tratamiento.ifBlank { null })
                })
            } else {
                Servicios.fuente.crearInforme(
                    NuevoInformeDto(
                        id = id, mascotaId = pacienteId, turnoId = turnoId,
                        veterinarioId = Sesion.usuarioId ?: error("No hay una sesión iniciada"),
                        motivo = motivo.ifBlank { null }, diagnostico = diagnostico.ifBlank { null },
                        tratamiento = tratamiento.ifBlank { null }
                    )
                )
            }
        }
    }
}
