package frgp.utn.edu.petcare.ui.dueno

import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.google.android.material.imageview.ShapeableImageView
import com.google.android.material.shape.RelativeCornerSize
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.model.VeterinarioAcceso
import frgp.utn.edu.petcare.ui.common.Efectos
import java.time.LocalDate
import java.time.YearMonth

/** Asistente de tres pasos para agendar un turno: tipo y mascota, veterinario/fecha/hora, y confirmación. */
class NuevoEventoPantalla(host: DuenoActivity) : Pantalla(host) {

    private val subtitulosPaso = listOf(
        "Paso 1 de 3 · Tipo de evento y mascota",
        "Paso 2 de 3 · Veterinario, fecha y hora",
        "Paso 3 de 3 · Revisá y confirmá"
    )
    private val categoriaIds = intArrayOf(R.id.optVacuna, R.id.optControl, R.id.optCirugia, R.id.optEstudio)

    private var paso = 1
    private var categoria: String? = null
    private var mascota: String? = null
    private var veterinario: String? = null
    private var hora: String? = null
    private var ocupadas: Set<String> = emptySet()
    private var observaciones = ""
    private var fecha: LocalDate = LocalDate.now()
    private var mes: YearMonth = YearMonth.now()

    fun mostrar(fechaPedida: LocalDate?, mascotaPreseleccionada: String?) {
        host.mostrarContenido(R.layout.nuevo_evento, -1)

        val inicial = if (fechaPedida == null || fechaPedida.isBefore(LocalDate.now())) LocalDate.now() else fechaPedida

        fecha = inicial
        mes = YearMonth.from(inicial)
        paso = 1
        categoria = null
        mascota = mascotaPreseleccionada
        veterinario = null
        hora = null
        ocupadas = emptySet()
        observaciones = ""

        alTocar(R.id.btnBack) { host.irACalendario() }

        categoriaIds.forEachIndexed { i, id ->
            alTocar(id) {
                Efectos.rebote(it)
                categoria = DuenoRepo.CATEGORIAS_EVENTO[i]
                veterinario = null
                pintarCategorias()
            }
        }

        alTocar(R.id.btnMesAnteriorMini) {
            if (mes.isAfter(YearMonth.now())) {
                mes = mes.minusMonths(1)
                dibujarCalendarioMini()
            } else {
                toast("No podés seleccionar una fecha que ya pasó")
            }
        }
        alTocar(R.id.btnMesSiguienteMini) {
            mes = mes.plusMonths(1)
            dibujarCalendarioMini()
        }

        vista<TextView>(R.id.btnAtrasCancelar)?.setOnClickListener {
            Efectos.rebote(it)
            if (paso == 1) {
                host.irACalendario()
            } else {
                if (paso == 2) guardarObservaciones()
                paso--
                actualizarPaso()
            }
        }
        vista<TextView>(R.id.btnSiguienteGuardar)?.setOnClickListener {
            Efectos.rebote(it)
            when (paso) {
                1 -> avanzarDelPrimerPaso()
                2 -> avanzarDelSegundoPaso()
                else -> confirmar()
            }
        }

        dibujarMascotas()
        actualizarPaso()
    }

    private fun avanzarDelPrimerPaso() {
        if (categoria == null || mascota == null) {
            toast("Seleccioná una categoría y una mascota")
            return
        }
        paso = 2
        actualizarPaso()
    }

    private fun avanzarDelSegundoPaso() {
        val horaElegida = hora
        val nombre = mascota
        val vet = DuenoRepo.buscarVeterinario(veterinario)
        when {
            vet == null -> toast("Seleccioná un veterinario")
            fecha.isBefore(LocalDate.now()) -> toast("No podés seleccionar una fecha que ya pasó")
            !DuenoRepo.trabajaEl(vet, fecha) -> toast("${vet.nombre} no atiende ese día")
            horaElegida == null || DuenoRepo.horaPasada(fecha, horaElegida) -> toast("Elegí un horario disponible")
            horaElegida in ocupadas -> toast("Ese horario ya fue reservado, elegí otro")
            DuenoRepo.hayConflictoDeTurno(fecha, horaElegida, nombre) -> toast("$nombre ya tiene un turno en ese horario")
            else -> {
                guardarObservaciones()
                paso = 3
                actualizarPaso()
            }
        }
    }

    private fun confirmar() {
        if (fecha.isBefore(LocalDate.now())) {
            toast("No podés seleccionar una fecha que ya pasó")
            return
        }
        DuenoRepo.agendarEvento(fecha, categoria!!, mascota!!, veterinario.orEmpty(), hora!!, observaciones)
        host.diaSeleccionado = fecha
        host.mesCalendario = YearMonth.from(fecha)
        toast("Evento guardado")
        host.irACalendario()
    }

    /** Pide al servidor los horarios que ya reservaron otros dueños con el veterinario elegido ese día. */
    private fun cargarOcupadas() {
        val vet = DuenoRepo.buscarVeterinario(veterinario) ?: return
        val dia = fecha
        host.lifecycleScope.launch {
            val reservadas = runCatching { DuenoRepo.horasOcupadas(vet, dia) }.getOrDefault(emptySet())
            if (dia == fecha && vet.nombre == veterinario) {
                ocupadas = reservadas
                if (hora in ocupadas) hora = null
                if (paso == 2) dibujarHoras()
            }
        }
    }

    private fun guardarObservaciones() {
        vista<EditText>(R.id.etObservaciones)?.let { observaciones = it.text.toString().trim() }
    }

    // ---------- Paso 1 ----------

    private fun pintarCategorias() {
        categoriaIds.forEachIndexed { i, id ->
            val opcion = vista<View>(id) ?: return@forEachIndexed
            val activa = DuenoRepo.CATEGORIAS_EVENTO[i] == categoria
            opcion.setBackgroundResource(if (activa) R.drawable.bg_card_selected else R.drawable.bg_card_white)
            opcion.findViewWithTag<View>("check")?.visibility = if (activa) View.VISIBLE else View.GONE
        }
    }

    private fun dibujarMascotas() {
        val fila = vista<LinearLayout>(R.id.llMascotasEvento) ?: return
        fila.removeAllViews()

        val mascotas = DuenoRepo.mascotas
        if (mascotas.none { it.nombre == mascota }) mascota = null

        for (m in mascotas) {
            val activa = m.nombre == mascota
            val item = LinearLayout(host).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(dp(78), LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { marginEnd = dp(6) }
                isClickable = true
                isFocusable = true
            }

            val marco = FrameLayout(host).apply {
                layoutParams = LinearLayout.LayoutParams(dp(66), dp(66))
                setPadding(dp(3), dp(3), dp(3), dp(3))
                setBackgroundResource(if (activa) R.drawable.bg_pet_ring else R.drawable.circular_white)
                elevation = dp(2).toFloat()
            }
            if (m.fotoUri != null || m.fotoPath != null) {
                val foto = ShapeableImageView(host).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
                    )
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    shapeAppearanceModel = shapeAppearanceModel.toBuilder().setAllCornerSizes(RelativeCornerSize(0.5f)).build()
                    Imagenes.mostrar(this, m.fotoUri, m.fotoPath)
                }
                marco.addView(foto)
            } else {
                val inicial = TextView(host).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
                    )
                    gravity = Gravity.CENTER
                    setBackgroundResource(R.drawable.bg_circle_light_teal)
                    text = m.inicial
                    setTextColor(ContextCompat.getColor(host, R.color.primary_teal))
                    textSize = 22f
                    setTypeface(typeface, Typeface.BOLD)
                }
                marco.addView(inicial)
            }
            item.addView(marco)

            item.addView(TextView(host).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp(6) }
                text = m.nombre
                textSize = 13f
                setTypeface(typeface, if (activa) Typeface.BOLD else Typeface.NORMAL)
                setTextColor(ContextCompat.getColor(host, if (activa) R.color.primary_teal else R.color.text_gray))
            })

            item.setOnClickListener {
                Efectos.rebote(it)
                mascota = m.nombre
                dibujarMascotas()
            }
            fila.addView(item)
        }
    }

    // ---------- Paso 2 ----------

    private fun textoEstadoVeterinario(estado: EstadoAcceso) = when (estado) {
        EstadoAcceso.ACTIVO -> "Con acceso"
        EstadoAcceso.INACTIVO -> "Sin acceso · se restablece al agendar"
        else -> "Tendrá acceso al agendar"
    }

    private fun dibujarVeterinarios() {
        val contenedor = vista<LinearLayout>(R.id.veterinarioOptionsContainer) ?: return
        val sinVeterinarios = vista<TextView>(R.id.tvSinVeterinarios)
        contenedor.removeAllViews()

        val filtrados = DuenoRepo.veterinariosPara(categoria)
        if (filtrados.isEmpty()) {
            sinVeterinarios?.visibility = View.VISIBLE
            return
        }
        sinVeterinarios?.visibility = View.GONE
        filtrados.forEach { contenedor.addView(tarjetaVeterinario(it)) }
    }

    private fun tarjetaVeterinario(vet: VeterinarioAcceso): View {
        val seleccionado = vet.nombre == veterinario

        val tarjeta = LinearLayout(host).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundResource(if (seleccionado) R.drawable.bg_card_selected else R.drawable.bg_card_white)
            elevation = dp(2).toFloat()
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(10) }
        }

        val icono = FrameLayout(host).apply {
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(44))
            setBackgroundResource(R.drawable.bg_icon_tile)
        }
        icono.addView(ImageView(host).apply {
            layoutParams = FrameLayout.LayoutParams(dp(22), dp(22)).apply { gravity = Gravity.CENTER }
            setImageResource(R.drawable.ic_medical_kit)
            setColorFilter(ContextCompat.getColor(host, R.color.primary_teal))
        })
        tarjeta.addView(icono)

        val textos = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                .apply { marginStart = dp(12) }
        }
        textos.addView(TextView(host).apply {
            text = vet.nombre
            setTextColor(ContextCompat.getColor(host, R.color.brand_navy))
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
        })
        textos.addView(TextView(host).apply {
            text = "${vet.matricula} · ${textoEstadoVeterinario(vet.estado)}"
            setTextColor(ContextCompat.getColor(host, R.color.text_gray))
            textSize = 12.5f
        })
        tarjeta.addView(textos)

        tarjeta.addView(ImageView(host).apply {
            layoutParams = LinearLayout.LayoutParams(dp(24), dp(24))
            if (seleccionado) {
                setImageResource(R.drawable.ic_check_circle)
                setColorFilter(ContextCompat.getColor(host, R.color.primary_teal))
            } else {
                setImageResource(R.drawable.ic_chevron_right)
                setColorFilter(ContextCompat.getColor(host, R.color.text_gray))
            }
        })

        tarjeta.setOnClickListener {
            Efectos.rebote(it)
            veterinario = vet.nombre
            hora = null
            dibujarVeterinarios()
            cargarOcupadas()
        }
        return tarjeta
    }

    private fun dibujarCalendarioMini() {
        texto(R.id.tvMesAnoMini, Fechas.mesAnio(mes))
        val grilla = vista<GridLayout>(R.id.gridCalendarioMini) ?: return
        grilla.removeAllViews()

        repeat(mes.atDay(1).dayOfWeek.value - 1) {
            grilla.addView(View(host).apply { layoutParams = parametrosCasillero() })
        }
        for (dia in 1..mes.lengthOfMonth()) grilla.addView(casilleroDia(mes.atDay(dia), dia))
    }

    private fun parametrosCasillero() = GridLayout.LayoutParams().apply {
        width = 0
        height = dp(42)
        columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
    }

    private fun casilleroDia(dia: LocalDate, numero: Int): FrameLayout {
        val casillero = FrameLayout(host).apply { layoutParams = parametrosCasillero() }
        val vet = DuenoRepo.buscarVeterinario(veterinario)
        val noAtiende = vet != null && !DuenoRepo.trabajaEl(vet, dia)
        val esPasado = dia.isBefore(LocalDate.now())
        val esHoy = dia == LocalDate.now()
        val seleccionado = dia == fecha

        val texto = TextView(host).apply {
            layoutParams = FrameLayout.LayoutParams(dp(36), dp(36)).apply { gravity = Gravity.CENTER }
            text = numero.toString()
            gravity = Gravity.CENTER
            textSize = 14f
        }
        when {
            seleccionado -> {
                texto.setBackgroundResource(R.drawable.bg_day_selected)
                texto.setTextColor(ContextCompat.getColor(host, R.color.white))
                texto.setTypeface(texto.typeface, Typeface.BOLD)
            }
            esPasado || noAtiende -> {
                texto.setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                texto.alpha = 0.4f
            }
            else -> {
                texto.setTextColor(ContextCompat.getColor(host, if (esHoy) R.color.primary_teal else R.color.brand_navy))
                if (esHoy) texto.setTypeface(texto.typeface, Typeface.BOLD)
            }
        }
        casillero.addView(texto)

        casillero.setOnClickListener {
            if (esPasado) {
                toast("No podés seleccionar una fecha que ya pasó")
                return@setOnClickListener
            }
            if (noAtiende) {
                toast("${vet?.nombre} no atiende ese día")
                return@setOnClickListener
            }
            Efectos.rebote(texto)
            fecha = dia
            hora = null
            dibujarCalendarioMini()
            dibujarHoras()
            cargarOcupadas()
        }
        return casillero
    }

    private fun dibujarHoras() {
        val grilla = vista<GridLayout>(R.id.gridHoras) ?: return
        grilla.removeAllViews()

        val vet = DuenoRepo.buscarVeterinario(veterinario)
        val horas = if (vet == null) emptyList() else DuenoRepo.horasDe(vet, fecha)
        texto(
            R.id.tvSinHoras,
            when {
                vet == null -> "Elegí un veterinario para ver sus horarios"
                horas.isEmpty() -> "${vet.nombre} no atiende ese día"
                else -> ""
            }
        )
        vista<View>(R.id.tvSinHoras)?.visibility = if (horas.isEmpty()) View.VISIBLE else View.GONE

        for (opcion in horas) {
            val pasada = DuenoRepo.horaPasada(fecha, opcion)
            val ocupada = opcion in ocupadas || DuenoRepo.hayConflictoDeTurno(fecha, opcion, mascota)
            val deshabilitada = pasada || ocupada
            val activa = opcion == hora && !deshabilitada

            val chip = TextView(host).apply {
                layoutParams = GridLayout.LayoutParams().apply {
                    width = 0
                    height = dp(46)
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                    setMargins(dp(4), dp(4), dp(4), dp(4))
                }
                gravity = Gravity.CENTER
                text = opcion
                textSize = 15f
                setTypeface(typeface, Typeface.BOLD)
                setBackgroundResource(if (activa) R.drawable.bg_time_chip_selected else R.drawable.bg_time_chip)
                setTextColor(ContextCompat.getColor(host, if (activa) R.color.white else R.color.brand_navy))
                alpha = if (deshabilitada) 0.4f else 1f
                isClickable = true
            }
            chip.setOnClickListener {
                when {
                    pasada -> toast("Ese horario ya pasó")
                    ocupada -> toast("Ese horario no está disponible")
                    else -> {
                        Efectos.rebote(it)
                        hora = opcion
                        dibujarHoras()
                    }
                }
            }
            grilla.addView(chip)
        }
    }

    // ---------- Pasos y resumen ----------

    private fun actualizarPaso() {
        intArrayOf(R.id.step1Content, R.id.step2Content, R.id.step3Content).forEachIndexed { i, id ->
            val contenido = vista<View>(id) ?: return@forEachIndexed
            if (i + 1 == paso) {
                contenido.visibility = View.VISIBLE
                Efectos.entradaDePaso(contenido, dp(16))
            } else {
                contenido.visibility = View.GONE
            }
        }

        val circulos = intArrayOf(R.id.step1Circle, R.id.step2Circle, R.id.step3Circle)
        val etiquetas = intArrayOf(R.id.step1Label, R.id.step2Label, R.id.step3Label)
        for (i in circulos.indices) {
            val activo = i + 1 == paso
            val completado = i + 1 < paso
            vista<TextView>(circulos[i])?.let {
                it.setBackgroundResource(
                    if (completado) R.drawable.bg_step_done else if (activo) R.drawable.bg_step_current else R.drawable.bg_step_pending
                )
                it.text = if (completado) "✓" else (i + 1).toString()
                it.setTextColor(
                    ContextCompat.getColor(host, if (completado) R.color.white else if (activo) R.color.primary_teal else R.color.text_gray)
                )
            }
            vista<TextView>(etiquetas[i])?.setTextColor(
                ContextCompat.getColor(host, if (activo || completado) R.color.primary_teal else R.color.text_gray)
            )
        }

        intArrayOf(R.id.line1, R.id.line2).forEachIndexed { i, id ->
            val completado = i + 1 < paso
            vista<View>(id)?.setBackgroundColor(
                if (completado) ContextCompat.getColor(host, R.color.primary_teal) else Color.parseColor("#E6EAE9")
            )
        }

        texto(R.id.tvStepSubtitle, subtitulosPaso[paso - 1])
        vista<TextView>(R.id.btnAtrasCancelar)?.text =
            host.getString(if (paso == 1) R.string.btn_cancelar else R.string.btn_atras)
        vista<TextView>(R.id.btnSiguienteGuardar)?.text =
            host.getString(if (paso == 3) R.string.btn_guardar_evento else R.string.btn_siguiente)

        when (paso) {
            1 -> {
                pintarCategorias()
                dibujarMascotas()
            }
            2 -> {
                dibujarVeterinarios()
                dibujarCalendarioMini()
                dibujarHoras()
            }
            else -> mostrarResumen()
        }
    }

    private fun mostrarResumen() {
        texto(R.id.tvResumenCategoria, if (categoria == DuenoRepo.CATEGORIA_VACUNA) "Vacunación" else categoria.orEmpty())
        texto(R.id.tvResumenMascota, mascota.orEmpty())
        texto(R.id.tvResumenVeterinario, veterinario.orEmpty())
        texto(R.id.tvResumenFecha, "${fecha.dayOfMonth} de ${Fechas.nombreMes(fecha.monthValue)}, ${fecha.year}")
        texto(R.id.tvResumenHora, "$hora hs")
        texto(R.id.tvResumenObservaciones, observaciones.ifEmpty { host.getString(R.string.sin_observaciones) })
        texto(
            R.id.tvNotaAcceso,
            "$veterinario va a poder ver la ficha de $mascota apenas confirmes el turno. No hace falta autorizarlo."
        )
    }
}
