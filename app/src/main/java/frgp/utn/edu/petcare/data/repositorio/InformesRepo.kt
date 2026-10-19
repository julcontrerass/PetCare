package frgp.utn.edu.petcare.data.repositorio

import frgp.utn.edu.petcare.data.remoto.InformeDto
import frgp.utn.edu.petcare.data.remoto.NuevoInformeDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.model.SignosVitales
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Informe de una consulta con el formato SOAP: lo que cuenta el dueño ([anamnesis]), lo que se observa y se mide
 * ([examenFisico] y [signos]), la impresión diagnóstica ([diagnostico]) y el plan ([tratamiento]).
 */
data class InformeData(
    val pacienteId: String,
    val turnoId: String? = null,
    val id: String? = null,
    var motivo: String = "",
    var diagnostico: String = "",
    var tratamiento: String = "",
    var anamnesis: String = "",
    var examenFisico: String = "",
    var signos: SignosVitales = SignosVitales(),
    /** Día en que se hizo el informe; null mientras todavía no se guardó. */
    val creadoEl: LocalDate? = null
) {
    /**
     * Un informe lo puede modificar quien lo hizo y solo el mismo día; después queda cerrado (el servidor lo
     * exige igual: acá se evita ofrecer lo que no se va a poder guardar).
     */
    val editable: Boolean
        get() = creadoEl == null || creadoEl == LocalDate.now()

    /** True si el veterinario todavía no escribió nada. */
    val vacio: Boolean
        get() = motivo.isBlank() && diagnostico.isBlank() && tratamiento.isBlank() && anamnesis.isBlank() &&
            examenFisico.isBlank() && signos.vacio
}

/**
 * Informe clínico que el veterinario en sesión escribe sobre un paciente. Cada turno tiene el suyo; los que se
 * escriben desde la ficha del paciente, sin turno, quedan como informe general.
 */
object InformesRepo {

    private val informes = mutableMapOf<String, InformeData>()

    fun limpiar() = informes.clear()

    private fun clave(pacienteId: String, turnoId: String?) = turnoId ?: "paciente:$pacienteId"

    private fun deDto(pacienteId: String, turnoId: String?, d: InformeDto) = InformeData(
        pacienteId, turnoId, d.id, d.motivo.orEmpty(), d.diagnostico.orEmpty(), d.tratamiento.orEmpty(),
        d.anamnesis.orEmpty(), d.examenFisico.orEmpty(),
        SignosVitales(d.pesoKg, d.temperaturaC, d.frecuenciaCardiaca, d.frecuenciaRespiratoria),
        d.createdAt?.let { Fechas.instante(it).toLocalDate() }
    )

    /** Trae del servidor el informe propio de ese turno (o el general del paciente si no hay turno). */
    suspend fun cargar(pacienteId: String, turnoId: String? = null): InformeData {
        val miId = Sesion.usuarioId
        val propio = Servicios.fuente.informesDe(pacienteId)
            .filter { it.veterinarioId == miId && it.turnoId == turnoId }
            .firstOrNull()
        val informe = if (propio == null) InformeData(pacienteId, turnoId) else deDto(pacienteId, turnoId, propio)
        informes[clave(pacienteId, turnoId)] = informe
        return informe
    }

    /** Lo último que se sabe del informe, sin pedirlo al servidor. */
    fun obtener(pacienteId: String, turnoId: String? = null): InformeData =
        informes[clave(pacienteId, turnoId)] ?: InformeData(pacienteId, turnoId)

    /** Todos los pesos medidos en consultas de esa mascota, del más viejo al más nuevo. */
    suspend fun pesos(pacienteId: String): List<Pair<java.time.LocalDate, Double>> =
        Servicios.fuente.informesDe(pacienteId)
            .filter { it.pesoKg != null }
            .map { Fechas.instante(it.createdAt).toLocalDate() to it.pesoKg!! }
            .sortedBy { it.first }

    fun guardar(
        pacienteId: String, motivo: String, diagnostico: String, tratamiento: String, turnoId: String? = null,
        anamnesis: String = "", examenFisico: String = "", signos: SignosVitales = SignosVitales()
    ) {
        val previo = informes[clave(pacienteId, turnoId)]
        // Un informe cerrado no se toca
        if (previo != null && !previo.editable) return
        val existente = previo?.id
        val id = existente ?: UUID.randomUUID().toString()
        informes[clave(pacienteId, turnoId)] = InformeData(
            pacienteId, turnoId, id, motivo, diagnostico, tratamiento, anamnesis, examenFisico, signos,
            previo?.creadoEl ?: LocalDate.now()
        )
        // El peso del informe es el actual del animal: se ve en su ficha sin esperar al servidor
        signos.pesoKg?.let { PacientesRepo.actualizarPeso(pacienteId, it) }
        Servicios.escribir(alFallar = { cargar(pacienteId, turnoId); Servicios.avisarCambio() }) {
            if (existente != null) {
                Servicios.fuente.actualizarInforme(existente, buildJsonObject {
                    put("motivo", motivo.ifBlank { null })
                    put("diagnostico", diagnostico.ifBlank { null })
                    put("tratamiento", tratamiento.ifBlank { null })
                    put("anamnesis", anamnesis.ifBlank { null })
                    put("examen_fisico", examenFisico.ifBlank { null })
                    put("peso_kg", signos.pesoKg)
                    put("temperatura_c", signos.temperaturaC)
                    put("frecuencia_cardiaca", signos.frecuenciaCardiaca)
                    put("frecuencia_respiratoria", signos.frecuenciaRespiratoria)
                })
            } else {
                Servicios.fuente.crearInforme(
                    NuevoInformeDto(
                        id = id, mascotaId = pacienteId, turnoId = turnoId,
                        veterinarioId = Sesion.usuarioId ?: error("No hay una sesión iniciada"),
                        motivo = motivo.ifBlank { null }, diagnostico = diagnostico.ifBlank { null },
                        tratamiento = tratamiento.ifBlank { null },
                        anamnesis = anamnesis.ifBlank { null }, examenFisico = examenFisico.ifBlank { null },
                        pesoKg = signos.pesoKg, temperaturaC = signos.temperaturaC,
                        frecuenciaCardiaca = signos.frecuenciaCardiaca,
                        frecuenciaRespiratoria = signos.frecuenciaRespiratoria
                    )
                )
            }
        }
    }
}
