package frgp.utn.edu.petcare.ui.common

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.View
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.model.SignosVitales
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** Línea con la evolución del peso de una mascota: un punto por cada vez que se la pesó. */
class GraficoPesoView @JvmOverloads constructor(
    contexto: Context, atributos: AttributeSet? = null, estilo: Int = 0
) : View(contexto, atributos, estilo) {

    private val densidad = resources.displayMetrics.density
    private val linea = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(13, 148, 136); strokeWidth = 3f * densidad; style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val punto = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(13, 148, 136) }
    private val centro = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val guia = Paint().apply { color = Color.rgb(226, 232, 240); strokeWidth = 1f * densidad }
    private val texto = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(100, 116, 139); textSize = 11f * densidad
    }
    private val valor = Paint(texto).apply { color = Color.rgb(15, 23, 42); isFakeBoldText = true }

    var puntos: List<Pair<LocalDate, Double>> = emptyList()
        set(nuevos) {
            field = nuevos.sortedBy { it.first }
            invalidate()
        }

    override fun onMeasure(anchoSpec: Int, altoSpec: Int) {
        val alto = (170 * densidad).toInt()
        setMeasuredDimension(
            resolveSize(suggestedMinimumWidth, anchoSpec),
            resolveSize(alto, altoSpec)
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (puntos.isEmpty()) return
        val izquierda = 12f * densidad
        val derecha = width - 12f * densidad
        val arriba = 26f * densidad
        val abajo = height - 26f * densidad

        val pesos = puntos.map { it.second }
        val minimo = pesos.min()
        val maximo = pesos.max()
        val rango = (maximo - minimo).takeIf { it > 0.0 } ?: 1.0

        val primera = puntos.first().first
        val dias = ChronoUnit.DAYS.between(primera, puntos.last().first).coerceAtLeast(1)

        fun x(f: LocalDate): Float =
            if (puntos.size == 1) (izquierda + derecha) / 2
            else izquierda + (derecha - izquierda) * (ChronoUnit.DAYS.between(primera, f).toFloat() / dias)

        fun y(p: Double): Float = (abajo - (abajo - arriba) * ((p - minimo) / rango)).toFloat()

        canvas.drawLine(izquierda, abajo, derecha, abajo, guia)
        canvas.drawLine(izquierda, arriba, derecha, arriba, guia)

        val camino = Path()
        puntos.forEachIndexed { i, (fecha, peso) ->
            if (i == 0) camino.moveTo(x(fecha), y(peso)) else camino.lineTo(x(fecha), y(peso))
        }
        if (puntos.size > 1) canvas.drawPath(camino, linea)

        puntos.forEachIndexed { i, (fecha, peso) ->
            val cx = x(fecha)
            val cy = y(peso)
            canvas.drawCircle(cx, cy, 5f * densidad, punto)
            canvas.drawCircle(cx, cy, 2.5f * densidad, centro)
            // Se rotulan solo el primero, el último y los extremos para que no se amontone
            val rotular = i == 0 || i == puntos.size - 1 || peso == minimo || peso == maximo
            if (rotular) {
                val etiqueta = SignosVitales.numero(peso) + " kg"
                val ancho = valor.measureText(etiqueta)
                val tx = (cx - ancho / 2).coerceIn(izquierda, derecha - ancho)
                canvas.drawText(etiqueta, tx, if (cy - 10f * densidad < arriba - 6f * densidad) cy + 20f * densidad else cy - 10f * densidad, valor)
            }
        }

        canvas.drawText(Fechas.corta(primera), izquierda, height - 6f * densidad, texto)
        if (puntos.size > 1) {
            val ultima = Fechas.corta(puntos.last().first)
            canvas.drawText(ultima, derecha - texto.measureText(ultima), height - 6f * densidad, texto)
        }
    }
}
