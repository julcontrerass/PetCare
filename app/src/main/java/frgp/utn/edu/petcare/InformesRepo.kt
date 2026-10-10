package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.NuevoInformeDto
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

data class InformeData(
    val pacienteId: String,
    val turnoId: String? = null,
    val id: String? = null,
    var motivo: String = "",
    var diagnostico: String = "",
    var tratamiento: String = ""
) {
    /** True si el veterinario todavía no escribió nada. */
    val vacio: Boolean get() = motivo.isBlank() && diagnostico.isBlank() && tratamiento.isBlank()
}

/**
 * Informe clínico que el veterinario en sesión escribe sobre un paciente. Cada turno tiene el suyo; los que se
 * escriben desde la ficha del paciente, sin turno, quedan como informe general.
 */
object InformesRepo {

    private val informes = mutableMapOf<String, InformeData>()

    fun limpiar() = informes.clear()

    private fun clave(pacienteId: String, turnoId: String?) = turnoId ?: "paciente:$pacienteId"

    /** Trae del servidor el informe propio de ese turno (o el general del paciente si no hay turno). */
    suspend fun cargar(pacienteId: String, turnoId: String? = null): InformeData {
        val miId = Sesion.usuarioId
        val propio = Servicios.fuente.informesDe(pacienteId)
            .filter { it.veterinarioId == miId && it.turnoId == turnoId }
            .firstOrNull()
        val informe = if (propio == null) InformeData(pacienteId, turnoId) else InformeData(
            pacienteId, turnoId, propio.id, propio.motivo.orEmpty(), propio.diagnostico.orEmpty(), propio.tratamiento.orEmpty()
        )
        informes[clave(pacienteId, turnoId)] = informe
        return informe
    }

    /** Lo último que se sabe del informe, sin pedirlo al servidor. */
    fun obtener(pacienteId: String, turnoId: String? = null): InformeData =
        informes[clave(pacienteId, turnoId)] ?: InformeData(pacienteId, turnoId)

    fun guardar(pacienteId: String, motivo: String, diagnostico: String, tratamiento: String, turnoId: String? = null) {
        val existente = informes[clave(pacienteId, turnoId)]?.id
        val id = existente ?: UUID.randomUUID().toString()
        informes[clave(pacienteId, turnoId)] = InformeData(pacienteId, turnoId, id, motivo, diagnostico, tratamiento)
        Servicios.escribir(alFallar = { cargar(pacienteId, turnoId); Servicios.avisarCambio() }) {
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
