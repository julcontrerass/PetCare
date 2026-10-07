package frgp.utn.edu.petcare.ui.dueno

import android.graphics.drawable.GradientDrawable
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.imageview.ShapeableImageView
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.model.EventoMascota
import frgp.utn.edu.petcare.model.Mascota
import frgp.utn.edu.petcare.ui.common.Efectos
import java.time.LocalDate

/** Inicio: resumen del próximo turno, accesos rápidos, mascotas, recordatorios y actividad reciente. */
class HomePantalla(host: DuenoActivity) : Pantalla(host) {

    fun mostrar() {
        host.mostrarContenido(R.layout.home_dueno, R.id.nav_home, inicio = true)
        configurarEncabezado()

        alTocar(R.id.iv_home_profile) { host.irAPerfil() }
        host.actualizarBadgeNotificaciones()
        val campana = vista<View>(R.id.btn_notifications_container) ?: vista<View>(R.id.btn_notifications)
        campana?.setOnClickListener {
            Efectos.rebote(it)
            host.mostrarNotificaciones()
        }

        alTocar(R.id.tv_ver_todas_mascotas) { host.irAMascotas() }
        alTocarConRebote(R.id.btnAddPetHome) { host.irANuevaMascota() }
        mostrarMascotas()

        alTocar(R.id.tv_ver_todas_recordatorios) { host.irARecordatorios() }
        mostrarRecordatorios()
        mostrarActividadReciente()
    }

    private fun configurarEncabezado() {
        val perfil = DuenoRepo.perfil
        if (perfil.nombre.isNotBlank()) texto(R.id.tv_welcome, "Hola, ${perfil.primerNombre}")
        cargarAvatar(vista(R.id.iv_home_profile))

        val hoy = LocalDate.now()
        texto(
            R.id.tvHomeSubtitle,
            "${Fechas.diaSemana(hoy)} ${hoy.dayOfMonth} de ${Fechas.nombreMes(hoy.monthValue).lowercase()} · " +
                host.getString(R.string.home_subtitulo)
        )

        configurarTarjetaPrincipal()

        alTocarConRebote(R.id.qaNuevoEvento) { host.irANuevoEvento(LocalDate.now()) }
        alTocarConRebote(R.id.qaHistorial) { host.irAMascotas() }
        alTocarConRebote(R.id.qaVeterinarios) { host.irAVeterinarios() }
        alTocarConRebote(R.id.qaDocumentos) { host.abrirCarnet() }
        alTocar(R.id.tv_ver_actividad) { host.irAMascotas() }
    }

    /** Foto del dueño; una cuenta nueva sin foto usa el avatar neutro en vez del de ejemplo. */
    private fun cargarAvatar(imagen: ImageView?) {
        imagen ?: return
        val foto = DuenoRepo.perfil.fotoUri
        if (foto != null) imagen.setImageURI(foto)
        else if (!DuenoRepo.esDemo) imagen.setImageResource(R.drawable.avatar_default)
    }

    /** Tarjeta verde del principio: el próximo turno o la invitación a agendar uno. */
    private fun configurarTarjetaPrincipal() {
        val etiqueta = vista<TextView>(R.id.tvHeroLabel)
        val titulo = vista<TextView>(R.id.tvHeroTitle) ?: return
        val subtitulo = vista<TextView>(R.id.tvHeroSubtitle) ?: return
        val accion = vista<TextView>(R.id.btnHeroAction) ?: return
        val icono = vista<ImageView>(R.id.ivHeroIcon)

        val proximo = DuenoRepo.eventosOrdenados(proximos = true).firstOrNull()
        if (proximo == null) {
            etiqueta?.setText(R.string.home_hero_todo_en_orden)
            titulo.setText(R.string.home_hero_sin_eventos)
            subtitulo.setText(R.string.home_hero_sin_eventos_msg)
            accion.setText(R.string.home_hero_agendar)
            icono?.setImageResource(R.drawable.ic_check)
            accion.setOnClickListener {
                Efectos.rebote(it)
                host.irANuevoEvento(LocalDate.now())
            }
            return
        }

        val dias = Componentes.diasHasta(proximo.fecha)
        val cuando = when {
            dias <= 0 -> "Hoy"
            dias == 1L -> "Mañana"
            else -> "${proximo.fecha.dayOfMonth} ${Fechas.mesCorto(proximo.fecha.monthValue)}"
        }
        val detalle = buildString {
            if (proximo.mascota.isNotEmpty()) append(proximo.mascota).append(" · ")
            append(cuando).append(", ").append(proximo.hora)
            if (proximo.veterinario.isNotEmpty()) append(" · ").append(proximo.veterinario)
        }
        etiqueta?.setText(R.string.home_hero_label)
        titulo.text = proximo.categoria
        subtitulo.text = detalle
        accion.setText(R.string.home_hero_ver_detalle)
        icono?.setImageResource(R.drawable.ic_calendar)
        accion.setOnClickListener {
            Efectos.rebote(it)
            host.irARecordatorios()
        }
    }

    private fun mostrarMascotas() {
        val fila = vista<LinearLayout>(R.id.containerMisMascotasHome) ?: return
        val botonAgregar = vista<View>(R.id.btnAddPetHome) ?: return
        var posicion = fila.indexOfChild(botonAgregar)
        for (mascota in DuenoRepo.mascotas) {
            fila.addView(tarjetaMascota(mascota, fila), posicion++)
        }
    }

    private fun tarjetaMascota(mascota: Mascota, padre: ViewGroup): View {
        val tarjeta = host.layoutInflater.inflate(R.layout.item_home_mascota, padre, false)
        val foto = tarjeta.findViewById<ShapeableImageView>(R.id.ivFoto)
        when {
            mascota.fotoUri != null -> foto.setImageURI(mascota.fotoUri)
            mascota.fotoRes != 0 -> foto.setImageResource(mascota.fotoRes)
            else -> {
                foto.setImageResource(R.drawable.ic_dog)
                foto.setBackgroundResource(R.drawable.bg_icon_teal)
                foto.setColorFilter(ContextCompat.getColor(host, R.color.primary_teal))
                val margen = dp(24)
                foto.setPadding(margen, margen, margen, margen)
            }
        }
        tarjeta.findViewById<TextView>(R.id.tvNombre).text = mascota.nombre
        tarjeta.findViewById<TextView>(R.id.tvDesc).text = mascota.raza.ifEmpty { mascota.tipo }
        Componentes.chipEstadoMascota(host, tarjeta.findViewById(R.id.tvChip), mascota.nombre)
        tarjeta.setOnClickListener { host.irADetalleMascota(mascota) }
        return tarjeta
    }

    private fun mostrarRecordatorios() {
        val contenedor = vista<LinearLayout>(R.id.containerRecordatoriosHome) ?: return
        contenedor.removeAllViews()
        val proximos = DuenoRepo.eventosOrdenados(proximos = true).take(3)
        proximos.forEach { contenedor.addView(tarjetaEvento(contenedor, it, proximo = true)) }
        if (proximos.isEmpty()) {
            contenedor.addView(
                Componentes.estadoVacio(
                    host, contenedor, R.drawable.ic_notifications, "No hay próximos recordatorios",
                    "Creá uno para no olvidarte de vacunas y controles", "+ Crear recordatorio"
                ) { host.irANuevoEvento(LocalDate.now()) }
            )
        }
    }

    private fun mostrarActividadReciente() {
        val contenedor = vista<LinearLayout>(R.id.containerActividadRecienteHome) ?: return
        contenedor.removeAllViews()
        val reciente = DuenoRepo.actividadReciente().take(5)
        reciente.forEach { contenedor.addView(tarjetaEvento(contenedor, it, proximo = false)) }
        if (reciente.isEmpty()) {
            contenedor.addView(
                Componentes.estadoVacio(
                    host, contenedor, R.drawable.ic_history, "Sin actividad en los últimos 30 días",
                    "Acá vas a ver consultas, vacunas y tratamientos"
                )
            )
        }
    }

    private fun tarjetaEvento(padre: ViewGroup, evento: EventoMascota, proximo: Boolean): View {
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

        val fechaCorta = "${evento.fecha.dayOfMonth} ${Fechas.mesCorto(evento.fecha.monthValue)}"
        tarjeta.findViewById<TextView>(R.id.tvTitulo).text = evento.categoria
        val subtitulo = tarjeta.findViewById<TextView>(R.id.tvSubtitulo)
        val chip = tarjeta.findViewById<TextView>(R.id.tvChip)

        if (proximo) {
            subtitulo.text = "${evento.mascota} · $fechaCorta · ${evento.hora}"
            val dias = Componentes.diasHasta(evento.fecha)
            val cercano = dias <= 1
            chip.text = when {
                dias <= 0 -> "Hoy"
                dias == 1L -> "Mañana"
                else -> "En $dias días"
            }
            chip.setBackgroundResource(if (cercano) R.drawable.bg_chip_warn else R.drawable.bg_chip_ok)
            chip.setTextColor(ContextCompat.getColor(host, if (cercano) R.color.accent_orange_dark else R.color.success_green))
            tarjeta.setOnClickListener { host.irARecordatorios() }
        } else {
            val veterinario = if (evento.veterinario.isNotEmpty()) " · ${evento.veterinario}" else ""
            subtitulo.text = "${evento.mascota} · $fechaCorta$veterinario"
            chip.visibility = View.GONE
            tarjeta.findViewById<View>(R.id.ivChevron).visibility = View.VISIBLE
            tarjeta.setOnClickListener {
                DuenoRepo.buscarMascota(evento.mascota)?.let { host.irADetalleMascota(it) } ?: host.irAMascotas()
            }
        }
        return tarjeta
    }
}
