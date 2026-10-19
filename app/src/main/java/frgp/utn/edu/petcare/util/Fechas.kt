package frgp.utn.edu.petcare.util

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId

object Fechas {
    private val meses = arrayOf("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")
    private val mesesLargos = arrayOf(
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    )

    fun corta(f: LocalDate) = "%02d %s %d".format(f.dayOfMonth, meses[f.monthValue - 1], f.year)
    fun mesAnio(f: LocalDate) = "${mesesLargos[f.monthValue - 1]} ${f.year}"
    fun mesCorto(f: LocalDate) = meses[f.monthValue - 1].uppercase()

    private val diasSemana = arrayOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")

    /** "Mayo" a partir del número de mes (1 a 12). */
    fun nombreMes(mes: Int) = mesesLargos[mes - 1]

    /** "Mayo 2026" cuando se pasa un año-mes. */
    fun mesAnio(ym: java.time.YearMonth) = "${mesesLargos[ym.monthValue - 1]} ${ym.year}"

    /** "Ene", "Feb"... */
    fun mesCorto(mes: Int) = meses[mes - 1]

    fun diaSemana(f: LocalDate) = diasSemana[f.dayOfWeek.value - 1]

    /** "15 de mayo de 2026". */
    fun larga(f: LocalDate) = "${f.dayOfMonth} de ${nombreMes(f.monthValue).lowercase()} de ${f.year}"

    /** Fecha tal como la guarda el servidor ("2026-03-15"); null si no hay o no se entiende. */
    fun iso(texto: String?): LocalDate? = texto?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }

    /** "15 Mar 2026" ("15 mar 2026" o "15/03/2026" también se entienden). */
    fun parsear(texto: String?): LocalDate? {
        if (texto == null) return null
        Regex("(\\d{1,2})\\s+([A-Za-zñÑ]{3,})\\.?\\s+(\\d{4})").find(texto)?.let { t ->
            val mes = t.groupValues[2].lowercase().take(3)
            val indice = meses.indexOfFirst { it.lowercase() == mes }
            if (indice >= 0) {
                return runCatching { LocalDate.of(t.groupValues[3].toInt(), indice + 1, t.groupValues[1].toInt()) }.getOrNull()
            }
        }
        Regex("(\\d{1,2})/(\\d{1,2})/(\\d{4})").find(texto)?.let { n ->
            return runCatching {
                LocalDate.of(n.groupValues[3].toInt(), n.groupValues[2].toInt(), n.groupValues[1].toInt())
            }.getOrNull()
        }
        return null
    }

    fun relativa(f: LocalDate, hoy: LocalDate = LocalDate.now()): String = when (f) {
        hoy -> "Hoy"
        hoy.plusDays(1) -> "Mañana"
        hoy.minusDays(1) -> "Ayer"
        else -> corta(f)
    }

    /** Convierte la fecha con zona horaria que manda el servidor a la hora local del teléfono. */
    fun instante(texto: String?): LocalDateTime =
        runCatching { OffsetDateTime.parse(texto).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime() }
            .getOrDefault(LocalDateTime.now())

    /** "Hace 5 min", "Hace 2 horas", "Ayer" o la fecha, según cuánto pasó. */
    fun haceTexto(texto: String?, ahora: LocalDateTime = LocalDateTime.now()): String {
        val momento = instante(texto)
        val minutos = java.time.Duration.between(momento, ahora).toMinutes().coerceAtLeast(0)
        return when {
            minutos < 1 -> "Ahora"
            minutos < 60 -> "Hace $minutos min"
            minutos < 24 * 60 -> "Hace ${minutos / 60} ${if (minutos / 60 == 1L) "hora" else "horas"}"
            else -> relativa(momento.toLocalDate(), ahora.toLocalDate())
        }
    }
}
