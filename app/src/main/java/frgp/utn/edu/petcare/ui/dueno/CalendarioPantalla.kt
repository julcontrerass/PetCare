package frgp.utn.edu.petcare.ui.dueno

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.model.EventoMascota
import frgp.utn.edu.petcare.ui.common.Efectos
import java.time.LocalDate
import java.time.YearMonth

/** Calendario mensual con los turnos del día elegido. */
class CalendarioPantalla(host: DuenoActivity) : Pantalla(host) {

    fun mostrar() {
        host.mostrarContenido(R.layout.calendario, -1)

        alTocar(R.id.btnBack) { host.irAHome() }
        alTocar(R.id.btnAgregarEvento) { host.irANuevoEvento(host.diaSeleccionado) }
        alTocar(R.id.btnMesAnterior) { host.mesCalendario = host.mesCalendario.minusMonths(1); dibujar() }
        alTocar(R.id.btnMesSiguiente) { host.mesCalendario = host.mesCalendario.plusMonths(1); dibujar() }
        alTocar(R.id.btnHoy) {
            Efectos.rebote(it)
            host.diaSeleccionado = LocalDate.now()
            host.mesCalendario = YearMonth.now()
            dibujar()
        }
        dibujar()
    }

    private fun dibujar() {
        val mes = host.mesCalendario
        texto(R.id.tvMesAno, Fechas.mesAnio(mes))

        val turnosDelMes = DuenoRepo.cantidadDelMes(mes)
        texto(
            R.id.tvCalSubtitle,
            when (turnosDelMes) {
                0 -> "Sin turnos este mes"
                1 -> "1 turno este mes"
                else -> "$turnosDelMes turnos este mes"
            }
        )

        vista<GridLayout>(R.id.gridCalendario)?.let { grilla ->
            grilla.removeAllViews()
            // Casilleros vacíos hasta el primer día del mes (la semana empieza el lunes)
            repeat(mes.atDay(1).dayOfWeek.value - 1) { grilla.addView(casilleroVacio()) }
            for (dia in 1..mes.lengthOfMonth()) grilla.addView(casilleroDia(mes.atDay(dia), dia))
        }
        dibujarTurnosDelDia()
    }

    private fun parametrosCasillero() = GridLayout.LayoutParams().apply {
        width = 0
        height = dp(48)
        columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
    }

    private fun casilleroVacio() = View(host).apply { layoutParams = parametrosCasillero() }

    private fun casilleroDia(fecha: LocalDate, dia: Int): FrameLayout {
        val casillero = FrameLayout(host).apply { layoutParams = parametrosCasillero() }

        val seleccionado = fecha == host.diaSeleccionado
        val esHoy = fecha == LocalDate.now()
        val esPasado = fecha.isBefore(LocalDate.now())

        val numero = TextView(host).apply {
            layoutParams = FrameLayout.LayoutParams(dp(38), dp(38)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                topMargin = dp(2)
            }
            text = dia.toString()
            gravity = Gravity.CENTER
            textSize = 14f
        }
        when {
            seleccionado -> {
                numero.setBackgroundResource(R.drawable.bg_day_selected)
                numero.setTextColor(ContextCompat.getColor(host, R.color.white))
                numero.setTypeface(numero.typeface, Typeface.BOLD)
            }
            esHoy -> {
                numero.setBackgroundResource(R.drawable.bg_day_today)
                numero.setTextColor(ContextCompat.getColor(host, R.color.primary_teal))
                numero.setTypeface(numero.typeface, Typeface.BOLD)
            }
            else -> {
                numero.setTextColor(ContextCompat.getColor(host, if (esPasado) R.color.text_gray else R.color.brand_navy))
                numero.alpha = if (esPasado) 0.6f else 1f
            }
        }
        casillero.addView(numero)

        if (DuenoRepo.eventosDelDia(fecha).isNotEmpty()) {
            val punto = View(host).apply {
                layoutParams = FrameLayout.LayoutParams(dp(6), dp(6)).apply {
                    gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                    bottomMargin = dp(1)
                }
                setBackgroundResource(if (esPasado) R.drawable.bg_dot_teal else R.drawable.bg_dot_orange)
            }
            casillero.addView(punto)
        }

        casillero.setOnClickListener {
            host.diaSeleccionado = fecha
            dibujar()
        }
        return casillero
    }

    private fun dibujarTurnosDelDia() {
        val lista = vista<LinearLayout>(R.id.listaEventosDia) ?: return
        val dia = host.diaSeleccionado
        val prefijo = if (dia == LocalDate.now()) "Turnos de hoy · " else "Turnos del "
        texto(R.id.tvDiaSeleccionado, "$prefijo${dia.dayOfMonth} de ${Fechas.nombreMes(dia.monthValue).lowercase()}")

        lista.removeAllViews()
        val eventos = DuenoRepo.eventosDelDia(dia)
        val sinEventos = eventos.isEmpty()

        vista<TextView>(R.id.tvCantidadDia)?.let {
            it.visibility = if (sinEventos) View.GONE else View.VISIBLE
            if (!sinEventos) it.text = if (eventos.size == 1) "1 turno" else "${eventos.size} turnos"
        }

        vista<View>(R.id.emptyDia)?.let { vacio ->
            vacio.visibility = if (sinEventos) View.VISIBLE else View.GONE
            if (sinEventos) {
                vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_calendar)
                vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "Sin turnos este día"
                vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = "Agendá un control o una vacuna para tus mascotas"
                vacio.findViewById<TextView>(R.id.tvEmptyCta).apply {
                    text = "+ Agendar turno"
                    visibility = View.VISIBLE
                    setOnClickListener { host.irANuevoEvento(host.diaSeleccionado) }
                }
            }
        }
        eventos.forEach { lista.addView(tarjetaTurno(lista, it)) }
    }

    private fun tarjetaTurno(padre: ViewGroup, evento: EventoMascota): View {
        val tarjeta = host.layoutInflater.inflate(R.layout.item_home_evento, padre, false)

        val fondoIcono = GradientDrawable().apply {
            cornerRadius = dp(13).toFloat()
            setColor(ContextCompat.getColor(host, EstiloCategoria.fondo(evento.categoria)))
        }
        tarjeta.findViewById<View>(R.id.flIcono).background = fondoIcono
        tarjeta.findViewById<ImageView>(R.id.ivIcono).apply {
            setImageResource(EstiloCategoria.icono(evento.categoria))
            setColorFilter(ContextCompat.getColor(host, EstiloCategoria.colorIcono(evento.categoria)))
        }

        tarjeta.findViewById<TextView>(R.id.tvTitulo).text =
            if (evento.categoria == DuenoRepo.CATEGORIA_VACUNA) "Vacunación" else evento.categoria
        val veterinario = if (evento.veterinario.isNotEmpty()) " · ${evento.veterinario}" else ""
        tarjeta.findViewById<TextView>(R.id.tvSubtitulo).text = evento.mascota + veterinario

        tarjeta.findViewById<TextView>(R.id.tvChip).apply {
            text = evento.hora
            setBackgroundResource(R.drawable.bg_chip_neutral)
            setTextColor(ContextCompat.getColor(host, R.color.teal_dark))
        }
        tarjeta.findViewById<View>(R.id.ivChevron).visibility = View.VISIBLE
        tarjeta.setOnClickListener { host.dialogosEventos.mostrarDetalle(evento) { dibujar() } }
        return tarjeta
    }
}
