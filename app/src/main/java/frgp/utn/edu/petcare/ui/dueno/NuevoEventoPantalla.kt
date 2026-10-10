package frgp.utn.edu.petcare.ui.dueno

import android.graphics.Color
import frgp.utn.edu.petcare.model.EventoMascota
import android.content.res.ColorStateList
import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.ui.common.ArchivosUi
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.data.Errores
import androidx.appcompat.app.AlertDialog
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

    private var paso = 1
    private var categoria: String? = null
    private var mascota: String? = null
    private var veterinario: String? = null
    private var hora: String? = null
    private var ocupadas: Set<String> = emptySet()
    private val estudios = mutableListOf<DuenoRepo.EstudioAdjunto>()
    private var observaciones = ""
    private var fecha: LocalDate = LocalDate.now()
    private var mes: YearMonth = YearMonth.now()

    /** Turno que se está editando; null cuando el asistente crea uno nuevo. */
    private var edicion: EventoMascota? = null

    /**
     * Edita un turno con las mismas reglas que al sacarlo: solo los días y horarios en que atiende el
     * veterinario, sin los que ya reservó otra persona ni los que pasaron.
     */
    fun mostrarEdicion(evento: EventoMascota) {
        mostrar(evento.fecha, evento.mascota)
        edicion = evento
        categoria = evento.categoria
        mascota = evento.mascota
        veterinario = evento.veterinario.ifBlank { null }
        fecha = evento.fecha
        mes = YearMonth.from(evento.fecha)
        hora = evento.hora
        observaciones = evento.observaciones
        paso = 2
        vista<EditText>(R.id.etObservaciones)?.setText(observaciones)
        vista<View>(R.id.stepperRow)?.visibility = View.GONE
        texto(R.id.tvTitle, "Editar turno")
        vista<TextView>(R.id.tvTurnoActual)?.apply {
            val conVet = evento.veterinario.takeIf { it.isNotBlank() }?.let { " con $it" }.orEmpty()
            text = "Turno actual de ${evento.mascota}\n${evento.categoria} · ${Fechas.larga(evento.fecha)} a las ${evento.hora} hs$conVet"
            visibility = View.VISIBLE
        }
        actualizarPaso()
        cargarOcupadas()
    }

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
        estudios.clear()
        observaciones = ""
        edicion = null

        alTocar(R.id.btnBack) { host.irACalendario() }

        filtroServicio = ""
        vista<EditText>(R.id.etBuscarServicio)?.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {
                filtroServicio = s?.toString().orEmpty()
                pintarCategorias()
            }

            override fun afterTextChanged(s: android.text.Editable?) {}
        })

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
            if (paso == 1 || edicion != null) {
                host.irACalendario()
            } else {
                if (paso == 2) guardarObservaciones()
                paso--
                actualizarPaso()
            }
        }
        vista<TextView>(R.id.btnSiguienteGuardar)?.setOnClickListener {
            Efectos.rebote(it)
            if (edicion != null) {
                guardarEdicion()
                return@setOnClickListener
            }
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

    /** Comprueba que el veterinario, el día y el horario elegidos se puedan reservar; si no, avisa por qué. */
    private fun horarioValido(): Boolean {
        val horaElegida = hora
        val nombre = mascota
        val vet = DuenoRepo.buscarVeterinario(veterinario)
        val mensaje = when {
            vet == null -> "Seleccioná un veterinario"
            fecha.isBefore(LocalDate.now()) -> "No podés seleccionar una fecha que ya pasó"
            !DuenoRepo.trabajaEl(vet, fecha) -> "${vet.nombre} no atiende ese día"
            horaElegida == null || DuenoRepo.horaPasada(fecha, horaElegida) -> "Elegí un horario disponible"
            horaElegida in ocupadas -> "Ese horario ya fue reservado, elegí otro"
            DuenoRepo.hayConflictoDeTurno(fecha, horaElegida, nombre, edicion) -> "$nombre ya tiene un turno en ese horario"
            else -> null
        }
        mensaje?.let { toast(it) }
        return mensaje == null
    }

    private fun avanzarDelSegundoPaso() {
        if (!horarioValido()) return
        guardarObservaciones()
        paso = 3
        actualizarPaso()
    }

    /** Guarda los cambios del turno que se está editando y vuelve al calendario. */
    private fun guardarEdicion() {
        val evento = edicion ?: return
        guardarObservaciones()
        if (!horarioValido()) return
        val sinCambios = fecha == evento.fecha && hora == evento.hora && veterinario.orEmpty() == evento.veterinario &&
            observaciones == evento.observaciones
        if (sinCambios) {
            toast("No hiciste ningún cambio")
            return
        }
        DuenoRepo.modificarEvento(evento, fecha, hora!!, veterinario.orEmpty(), observaciones)
        host.diaSeleccionado = fecha
        host.mesCalendario = YearMonth.from(fecha)
        toast("Turno actualizado")
        host.irACalendario()
    }

    private fun confirmar() {
        if (fecha.isBefore(LocalDate.now())) {
            toast("No podés seleccionar una fecha que ya pasó")
            return
        }
        DuenoRepo.agendarEvento(
            fecha, categoria!!, mascota!!, veterinario.orEmpty(), hora!!, observaciones, estudios.toList()
        )
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
            var reservadas = runCatching { DuenoRepo.horasOcupadas(vet, dia) }.getOrDefault(emptySet())
            // El horario que ya tiene este mismo turno no está "ocupado" para quien lo está editando
            val propio = edicion
            if (propio != null && propio.veterinario == vet.nombre && propio.fecha == dia) reservadas = reservadas - propio.hora
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

    /** Texto del buscador de servicios; vacío muestra todos. */
    private var filtroServicio = ""

    private fun sinAcentos(texto: String) =
        java.text.Normalizer.normalize(texto, java.text.Normalizer.Form.NFD).replace(Regex("\\p{M}"), "").lowercase()

    /** Presenta los servicios y las especialidades como tarjetas con ícono; la elegida queda resaltada. */
    private fun pintarCategorias() {
        val contenedor = vista<LinearLayout>(R.id.llServiciosEvento) ?: return
        contenedor.removeAllViews()
        val buscado = sinAcentos(filtroServicio.trim())

        fun encabezado(titulo: String, detalle: String, cantidad: Int) {
            val fila = LinearLayout(host).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp(18); bottomMargin = dp(8) }
            }
            val textos = LinearLayout(host).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            textos.addView(TextView(host).apply {
                text = titulo
                setTextColor(ContextCompat.getColor(host, R.color.brand_navy))
                textSize = 16f
                setTypeface(typeface, Typeface.BOLD)
            })
            textos.addView(TextView(host).apply {
                text = detalle
                setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                textSize = 12.5f
            })
            fila.addView(textos)
            fila.addView(TextView(host).apply {
                text = cantidad.toString()
                gravity = Gravity.CENTER
                textSize = 12.5f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(ContextCompat.getColor(host, R.color.primary_teal))
                setBackgroundResource(R.drawable.bg_icon_teal)
                layoutParams = LinearLayout.LayoutParams(dp(30), dp(30))
            })
            contenedor.addView(fila)
        }

        fun tarjeta(nombre: String): View {
            val estilo = EstiloCategoria.servicio(nombre)
            val activa = nombre == categoria
            val tarjeta = FrameLayout(host).apply {
                setBackgroundResource(if (activa) R.drawable.bg_card_selected else R.drawable.bg_card_white)
                elevation = dp(if (activa) 0 else 2).toFloat()
                isClickable = true
                isFocusable = true
                layoutParams = GridLayout.LayoutParams().apply {
                    width = 0
                    height = GridLayout.LayoutParams.WRAP_CONTENT
                    // Las dos tarjetas de una fila tienen la misma altura aunque el nombre ocupe más líneas
                    rowSpec = GridLayout.spec(GridLayout.UNDEFINED, GridLayout.FILL)
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, GridLayout.FILL, 1f)
                    setMargins(dp(5), dp(5), dp(5), dp(5))
                }
                setOnClickListener {
                    Efectos.rebote(it)
                    categoria = nombre
                    veterinario = null
                    pintarCategorias()
                }
            }
            val contenido = LinearLayout(host).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(dp(10), dp(14), dp(10), dp(14))
            }
            val circulo = FrameLayout(host).apply {
                setBackgroundResource(R.drawable.bg_icon_teal)
                backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(host, estilo.fondo))
                layoutParams = LinearLayout.LayoutParams(dp(46), dp(46))
            }
            circulo.addView(ImageView(host).apply {
                setImageResource(estilo.icono)
                setColorFilter(ContextCompat.getColor(host, estilo.color))
                layoutParams = FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER)
            })
            contenido.addView(circulo)
            contenido.addView(TextView(host).apply {
                text = nombre
                gravity = Gravity.CENTER
                maxLines = 3
                textSize = 13.5f
                setTypeface(typeface, if (activa) Typeface.BOLD else Typeface.NORMAL)
                setTextColor(ContextCompat.getColor(host, if (activa) R.color.primary_teal else R.color.brand_navy))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp(10) }
            })
            tarjeta.addView(contenido)
            if (activa) {
                tarjeta.addView(ImageView(host).apply {
                    setImageResource(R.drawable.ic_check_circle)
                    setColorFilter(ContextCompat.getColor(host, R.color.primary_teal))
                    layoutParams = FrameLayout.LayoutParams(dp(22), dp(22), Gravity.TOP or Gravity.END)
                        .apply { setMargins(0, dp(8), dp(8), 0) }
                })
            }
            return tarjeta
        }

        fun seccion(titulo: String, detalle: String, nombres: List<String>) {
            val visibles = nombres.filter { buscado.isEmpty() || sinAcentos(it).contains(buscado) }
            if (visibles.isEmpty()) return
            encabezado(titulo, detalle, visibles.size)
            val grilla = GridLayout(host).apply {
                columnCount = 2
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                )
            }
            visibles.forEach { grilla.addView(tarjeta(it)) }
            contenedor.addView(grilla)
        }

        seccion("Servicios", "Atención y procedimientos de la clínica", CatalogoMedico.SERVICIOS)
        seccion("Especialidades médicas", "Consultas con profesionales especializados", CatalogoMedico.ESPECIALIDADES)

        if (contenedor.childCount == 0) {
            contenedor.addView(TextView(host).apply {
                text = "No encontramos ningún servicio con ese nombre."
                gravity = Gravity.CENTER
                setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                setPadding(0, dp(24), 0, dp(24))
            })
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

        var filtrados = DuenoRepo.veterinariosPara(categoria)
        // Un turno viejo puede tener un servicio que nadie ofrece hoy: al editarlo se muestran todos los veterinarios
        if (edicion != null && filtrados.isEmpty()) filtrados = DuenoRepo.todosLosVeterinarios()
        if (filtrados.isEmpty()) {
            sinVeterinarios?.text = "Ningún veterinario atiende ${categoria ?: "este servicio"} por ahora. Probá con otro servicio o especialidad."
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

        if (edicion != null) {
            texto(R.id.tvStepSubtitle, "Elegí otro veterinario, día u horario")
            vista<TextView>(R.id.btnAtrasCancelar)?.text = host.getString(R.string.btn_cancelar)
            vista<TextView>(R.id.btnSiguienteGuardar)?.text = "Guardar cambios"
        }

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
            else -> {
                mostrarResumen()
                configurarEstudios()
            }
        }
    }

    // ---------- Estudios previos ----------

    private fun mascotaElegida() = DuenoRepo.buscarMascota(mascota)

    private fun dibujarEstudios() {
        val contenedor = vista<LinearLayout>(R.id.llEstudiosTurno) ?: return
        val vacio = vista<View>(R.id.tvSinEstudios) ?: return
        contenedor.removeAllViews()
        if (estudios.isEmpty()) {
            contenedor.addView(vacio)
            return
        }
        estudios.toList().forEach { estudio ->
            val fila = host.layoutInflater.inflate(R.layout.item_turno_detalle, contenedor, false)
            fila.findViewById<ImageView>(R.id.ivDetalleIcono).setImageResource(R.drawable.ic_document)
            fila.findViewById<TextView>(R.id.tvDetalleTitulo).text = "${estudio.tipo} · ${estudio.extension.uppercase()}"
            fila.findViewById<TextView>(R.id.tvDetalleValor).text = estudio.nombre
            fila.findViewById<TextView>(R.id.tvDetalleAccion).apply {
                text = "Quitar"
                setTextColor(ContextCompat.getColor(host, R.color.danger_red))
                visibility = View.VISIBLE
            }
            fila.setOnClickListener {
                estudios.remove(estudio)
                dibujarEstudios()
            }
            contenedor.addView(fila)
        }
    }

    private fun configurarEstudios() {
        dibujarEstudios()
        alTocar(R.id.btnElegirEstudio) { elegirEstudioCargado() }
        alTocar(R.id.btnSubirEstudio) { subirEstudioNuevo() }
    }

    /** Lista los estudios que la mascota ya tiene en la ficha para marcar los que hagan falta. */
    private fun elegirEstudioCargado() {
        val m = mascotaElegida() ?: return
        host.lifecycleScope.launch {
            val disponibles = runCatching { DuenoRepo.estudiosDisponibles(m) }.getOrNull()
            if (disponibles == null) {
                Avisos.error(host, "No pudimos traer los estudios cargados. Revisá tu conexión.")
                return@launch
            }
            val faltan = disponibles.filter { d -> estudios.none { it.ruta == d.ruta } }
            if (faltan.isEmpty()) {
                toast("${m.nombre} no tiene estudios cargados todavía. Podés subir uno nuevo.")
                return@launch
            }
            val marcados = BooleanArray(faltan.size)
            AlertDialog.Builder(host)
                .setTitle("Estudios de ${m.nombre}")
                .setMultiChoiceItems(faltan.map { "${it.nombre} (${it.extension.uppercase()})" }.toTypedArray(), marcados) { _, i, marcado ->
                    marcados[i] = marcado
                }
                .setPositiveButton("Adjuntar") { _, _ ->
                    faltan.filterIndexed { i, _ -> marcados[i] }.forEach { estudios.add(it) }
                    dibujarEstudios()
                }
                .setNegativeButton(R.string.btn_cancelar, null)
                .show()
        }
    }

    /** Sube un estudio nuevo a la ficha de la mascota y lo deja adjunto a este turno. */
    private fun subirEstudioNuevo() {
        val m = mascotaElegida() ?: return
        host.pedirArchivo { uri ->
            host.lifecycleScope.launch {
                val elegido = ArchivosUi.leer(host, uri) ?: return@launch
                // Antes de subirlo se pregunta qué clase de estudio es, para que el veterinario lo identifique
                val tipos = DuenoRepo.TIPOS_ESTUDIO.toTypedArray()
                AlertDialog.Builder(host)
                    .setTitle("¿Qué tipo de estudio es?")
                    .setItems(tipos) { _, i ->
                        host.lifecycleScope.launch {
                            try {
                                val estudio = DuenoRepo.subirEstudio(
                                    m, tipos[i], elegido.nombre, elegido.extension, elegido.bytes, elegido.mime
                                )
                                estudios.add(estudio)
                                dibujarEstudios()
                                toast("${tipos[i]} subido y adjunto al turno")
                            } catch (e: Exception) {
                                Avisos.error(host, Errores.mensaje(e))
                            }
                        }
                    }
                    .setNegativeButton(R.string.btn_cancelar, null)
                    .show()
            }
        }
    }

    private fun mostrarResumen() {
        texto(R.id.tvResumenCategoria, categoria.orEmpty())
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
