package frgp.utn.edu.petcare.model

import frgp.utn.edu.petcare.data.remoto.PrescripcionDto
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import java.time.LocalDateTime

/** Lo que se mide en la consulta; cada dato es opcional. */
data class SignosVitales(
    val pesoKg: Double? = null,
    val temperaturaC: Double? = null,
    val frecuenciaCardiaca: Int? = null,
    val frecuenciaRespiratoria: Int? = null
) {
    val vacio: Boolean
        get() = pesoKg == null && temperaturaC == null && frecuenciaCardiaca == null && frecuenciaRespiratoria == null

    /** "Peso 12 kg · Temp. 38.5 °C · FC 90 lpm · FR 20 rpm" con lo que haya. */
    fun texto(): String = listOfNotNull(
        pesoKg?.let { "Peso ${numero(it)} kg" },
        temperaturaC?.let { "Temp. ${numero(it)} °C" },
        frecuenciaCardiaca?.let { "FC $it lpm" },
        frecuenciaRespiratoria?.let { "FR $it rpm" }
    ).joinToString(" · ")

    companion object {
        const val PESO_MAXIMO = 999.0
        val TEMPERATURA = 25.0..45.0
        val FRECUENCIA_CARDIACA = 10..400
        val FRECUENCIA_RESPIRATORIA = 2..200

        fun numero(valor: Double): String = if (valor % 1.0 == 0.0) valor.toInt().toString() else "%.1f".format(valor)
    }
}

/** Un medicamento recetado en una consulta. */
data class Prescripcion(
    val id: String,
    val mascotaId: String,
    val turnoId: String?,
    val medicamento: String,
    val dosis: String = "",
    val frecuenciaHoras: Int? = null,
    val duracionDias: Int? = null,
    val indicaciones: String = "",
    val inicio: LocalDate = LocalDate.now(),
    /** Cuándo se recetó; de ahí se cuentan las tomas. */
    val creada: LocalDateTime? = null
) {
    /** "250 mg, cada 8 hs, durante 7 días". */
    val posologia: String
        get() = listOfNotNull(
            dosis.takeIf { it.isNotBlank() },
            frecuenciaHoras?.let { "cada $it hs" },
            duracionDias?.let { "durante $it ${if (it == 1) "día" else "días"}" }
        ).joinToString(", ")

    companion object {
        fun deDto(d: PrescripcionDto) = Prescripcion(
            id = d.id, mascotaId = d.mascotaId, turnoId = d.turnoId, medicamento = d.medicamento,
            dosis = d.dosis.orEmpty(), frecuenciaHoras = d.frecuenciaHoras, duracionDias = d.duracionDias,
            indicaciones = d.indicaciones.orEmpty(),
            inicio = runCatching { LocalDate.parse(d.inicio) }.getOrDefault(LocalDate.now()),
            creada = d.createdAt?.let { Fechas.instante(it) }
        )
    }
}
