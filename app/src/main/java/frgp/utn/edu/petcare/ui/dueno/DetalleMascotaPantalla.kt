package frgp.utn.edu.petcare.ui.dueno

import android.graphics.Typeface
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.HistorialAdapter
import frgp.utn.edu.petcare.HistorialItem
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.model.Mascota
import frgp.utn.edu.petcare.model.SIN_DATOS
import frgp.utn.edu.petcare.model.Sexo
import frgp.utn.edu.petcare.ui.common.Efectos
import java.time.LocalDate

/** Ficha de una mascota, con las pestañas Información, Historial y Recordatorios. */
class DetalleMascotaPantalla(host: DuenoActivity) : Pantalla(host) {

    private var pestaña = 0
    private var ficha = 0

    private val mascota: Mascota? get() = host.mascotaActual

    fun mostrar() {
        val actual = mascota ?: DuenoRepo.mascotas.firstOrNull()?.also { host.mascotaActual = it } ?: run {
            host.irAMascotas()
            return
        }
        host.mostrarContenido(R.layout.mascota_shell, R.id.nav_mascotas)

        vista<Toolbar>(R.id.toolbar)?.let { barra ->
            barra.setNavigationOnClickListener { host.irAMascotas() }
            barra.findViewById<TextView>(R.id.toolbar_title)?.text = actual.nombre
        }
        alTocar(R.id.btnMore) { mostrarMenu(it) }

        pestaña = 0
        ficha++
        mostrarPestaña(0, animar = false)

        vista<TabLayout>(R.id.tabLayout)?.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab) {
                if (tab.position != pestaña) mostrarPestaña(tab.position, animar = true)
            }

            override fun onTabUnselected(tab: TabLayout.Tab) {}
            override fun onTabReselected(tab: TabLayout.Tab) {}
        })
    }

    /** Cambia solo el contenido de la ficha: la barra y las pestañas quedan fijas y el contenido se desliza. */
    private fun mostrarPestaña(posicion: Int, animar: Boolean) {
        val contenido = vista<FrameLayout>(R.id.petTabContent) ?: return
        val layout = when (posicion) {
            0 -> R.layout.contenido_info
            1 -> R.layout.contenido_historial
            else -> R.layout.contenido_recordatorios
        }
        val direccion = if (posicion >= pestaña) 1 else -1
        pestaña = posicion
        val token = ++ficha
        val desplazamiento = dp(36).toFloat()

        val mostrarNuevo = {
            if (token == ficha) {
                contenido.removeAllViews()
                val nuevo = host.layoutInflater.inflate(layout, contenido, false)
                contenido.addView(nuevo)
                when (posicion) {
                    0 -> configurarInformacion()
                    1 -> configurarHistorial()
                    else -> host.recordatorios.configurarContenido(global = false, mascota = mascota?.nombre)
                }
                if (animar) {
                    nuevo.alpha = 0f
                    nuevo.translationX = direccion * desplazamiento
                    nuevo.animate().alpha(1f).translationX(0f).setDuration(240)
                        .setInterpolator(DecelerateInterpolator()).start()
                }
            }
        }

        if (animar && contenido.childCount > 0) {
            val viejo = contenido.getChildAt(0)
            viejo.animate().cancel()
            viejo.animate().alpha(0f).translationX(-direccion * desplazamiento).setDuration(140)
                .withEndAction(mostrarNuevo).start()
        } else {
            mostrarNuevo()
        }
    }

    // ---------- Pestaña "Información" ----------

    private fun configurarInformacion() {
        llenarFicha()

        val cambiarFoto = { v: View ->
            Efectos.rebote(v)
            elegirFoto()
        }
        alTocar(R.id.btnCameraOverlay, cambiarFoto)
        alTocar(R.id.petImageCard, cambiarFoto)
        alTocar(R.id.imageView3, cambiarFoto)

        alTocarConRebote(R.id.btnEditarInfo) { editarInformacion() }
        alTocar(R.id.btnDarDeBaja) { confirmarBaja() }
        alTocar(R.id.btnVerCarnet) { host.abrirCarnet() }
        alTocarConRebote(R.id.btnAgendarTurno) { host.irANuevoEvento(LocalDate.now(), mascota?.nombre) }
    }

    private fun elegirFoto() {
        host.pedirImagen { uri ->
            mascota?.fotoUri = uri
            vista<ImageView>(R.id.imageView3)?.setImageURI(uri)
        }
    }

    private fun llenarFicha() {
        val m = mascota ?: return
        texto(R.id.textView9, m.nombre)
        texto(R.id.textView10, m.tipoRazaTexto)
        texto(R.id.textView11, m.nacimientoSexoTexto)
        texto(R.id.editTextText, m.peso)
        texto(R.id.txtMicrochip, m.microchip)
        texto(R.id.editTextText2, m.color)
        texto(R.id.editTextText3, m.observaciones)
        vista<ImageView>(R.id.imageView3)?.let {
            when {
                m.fotoUri != null -> it.setImageURI(m.fotoUri)
                m.fotoRes != 0 -> it.setImageResource(m.fotoRes)
                else -> it.setImageResource(R.drawable.ic_dog)
            }
        }
        llenarResumen(m)
    }

    private fun llenarResumen(m: Mascota) {
        texto(R.id.tvStatEdad, m.edadTexto() ?: "—")
        texto(R.id.tvStatPeso, if (m.tienePesoValido) m.peso else "—")
        texto(R.id.tvStatSexo, m.sexo?.etiqueta ?: "—")
        Componentes.chipEstadoMascota(host, vista(R.id.tvSaludEstado), m.nombre)
        val proximo = MascotasPantalla.proximoEventoTexto(m.nombre)
        texto(R.id.tvSaludProximo, if (proximo != null) "Próximo: $proximo" else "Sin eventos próximos agendados")
    }

    private fun editarInformacion() {
        val m = mascota ?: return
        val parametros = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(0, 16, 0, 16) }

        fun campo(pista: String, valor: String) = EditText(host).apply {
            hint = pista
            setText(valor)
            layoutParams = parametros
        }

        val tipos = listOf(host.getString(R.string.tipo_perro), host.getString(R.string.tipo_gato), host.getString(R.string.tipo_otro))
        val selectorTipo = Spinner(host).apply {
            adapter = ArrayAdapter(host, android.R.layout.simple_spinner_dropdown_item, tipos)
            setSelection(tipos.indexOfFirst { it.equals(m.tipo, ignoreCase = true) }.coerceAtLeast(0))
            layoutParams = parametros
        }
        val inputNombre = campo("Nombre", m.nombre)
        val inputRaza = campo("Raza", m.raza)
        var nacimiento = m.nacimiento
        val inputNacimiento = campo("Fecha de nacimiento", nacimiento?.let { Fechas.corta(it) }.orEmpty()).apply {
            isFocusable = false
            isClickable = true
            setOnClickListener {
                Componentes.elegirFechaNacimiento(host, nacimiento) { fecha ->
                    nacimiento = fecha
                    setText(Fechas.corta(fecha))
                }
            }
        }
        val opcionesSexo = listOf("Sin especificar") + Sexo.entries.map { it.etiqueta }
        val selectorSexo = Spinner(host).apply {
            adapter = ArrayAdapter(host, android.R.layout.simple_spinner_dropdown_item, opcionesSexo)
            setSelection(m.sexo?.let { opcionesSexo.indexOf(it.etiqueta) } ?: 0)
            layoutParams = parametros
        }
        val inputPeso = campo("Peso", m.peso)
        val inputMicrochip = campo("Microchip", m.microchip)
        val inputColor = campo("Color", m.color)
        val inputObservaciones = campo("Observaciones", m.observaciones)

        val formulario = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 32)
            listOf(inputNombre, selectorTipo, inputRaza, inputNacimiento, selectorSexo, inputPeso, inputMicrochip, inputColor, inputObservaciones)
                .forEach { addView(it) }
        }

        AlertDialog.Builder(host)
            .setTitle("Editar Información de Mascota")
            .setView(ScrollView(host).apply { addView(formulario) })
            .setPositiveButton("Guardar") { _, _ ->
                val nombre = inputNombre.text.toString().trim()
                if (nombre.isEmpty()) {
                    toast("El nombre no puede quedar vacío")
                    return@setPositiveButton
                }
                m.nombre = nombre
                m.tipo = selectorTipo.selectedItem as String
                m.raza = inputRaza.text.toString().trim()
                m.nacimiento = nacimiento
                m.sexo = Sexo.deTexto(selectorSexo.selectedItem as String)
                m.peso = inputPeso.text.toString().trim().ifEmpty { SIN_DATOS }
                m.microchip = inputMicrochip.text.toString().trim().ifEmpty { SIN_DATOS }
                m.color = inputColor.text.toString().trim().ifEmpty { SIN_DATOS }
                m.observaciones = inputObservaciones.text.toString().trim().ifEmpty { "Sin observaciones" }
                vista<Toolbar>(R.id.toolbar)?.findViewById<TextView>(R.id.toolbar_title)?.text = m.nombre
                llenarFicha()
                toast("Información actualizada")
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    // ---------- Pestaña "Historial" ----------

    private fun configurarHistorial() {
        val m = mascota
        vista<RecyclerView>(R.id.recyclerViewHistorial)?.let { lista ->
            val items = DuenoRepo.eventosDeMascota(m?.nombre).sortedByDescending { it.fecha }.map { evento ->
                val veterinario = if (evento.veterinario.isNotEmpty()) " · ${evento.veterinario}" else ""
                HistorialItem(
                    evento.categoria, Fechas.corta(evento.fecha) + veterinario,
                    EstiloCategoria.icono(evento.categoria), EstiloCategoria.fondo(evento.categoria)
                ) {
                    host.dialogosEventos.mostrarDetalle(evento) { configurarHistorial() }
                }
            }.ifEmpty {
                listOf(
                    HistorialItem(
                        "Sin eventos clínicos", "No hay turnos registrados para ${m?.nombre ?: "esta mascota"}",
                        R.drawable.ic_calendar, R.color.icon_teal_bg
                    )
                )
            }
            lista.adapter = HistorialAdapter(items)
        }
        alTocarConRebote(R.id.fabAdd) { host.irANuevoEvento(host.diaSeleccionado) }
        alTocarConRebote(R.id.btnEditarEvento) { host.dialogosEventos.elegirParaEditar(m?.nombre) }
    }

    // ---------- Menú y baja ----------

    private fun mostrarMenu(ancla: View) {
        PopupMenu(host, ancla).apply {
            menu.add(0, 1, 0, "Editar información")
            menu.add(0, 2, 1, "Cambiar foto")
            menu.add(0, 3, 2, "Agendar turno")
            menu.add(0, 4, 3, "Eliminar mascota")
            setOnMenuItemClickListener { opcion ->
                when (opcion.itemId) {
                    1 -> editarInformacion()
                    2 -> elegirFoto()
                    3 -> host.irANuevoEvento(host.diaSeleccionado, mascota?.nombre)
                    else -> confirmarBaja()
                }
                true
            }
        }.show()
    }

    private fun confirmarBaja() {
        val m = mascota ?: return
        val contenedor = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            val margen = dp(20)
            setPadding(margen, margen, margen, margen)
        }
        contenedor.addView(TextView(host).apply {
            setText(R.string.confirmar_baja_msg)
            textSize = 14f
            setTextColor(ContextCompat.getColor(host, R.color.text_gray))
        })
        contenedor.addView(TextView(host).apply {
            setText(R.string.motivo_baja_label)
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(ContextCompat.getColor(host, R.color.black))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(16) }
        })
        contenedor.addView(RadioGroup(host).apply {
            orientation = RadioGroup.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(8) }
            addView(RadioButton(host).apply { setText(R.string.motivo_fallecimiento); isChecked = true })
            addView(RadioButton(host).apply { setText(R.string.motivo_adopcion) })
            addView(RadioButton(host).apply { setText(R.string.motivo_otro) })
        })

        val dialogo = AlertDialog.Builder(host)
            .setTitle(host.getString(R.string.confirmar_baja_title, m.nombre))
            .setView(contenedor)
            .setPositiveButton(R.string.btn_confirmar_baja) { _, _ ->
                DuenoRepo.darDeBajaMascota(m)
                host.mascotaActual = null
                toast(R.string.mascota_dada_de_baja_msg)
                host.irAMascotas()
            }
            .setNegativeButton(R.string.btn_cancelar, null)
            .create()
        dialogo.show()
        dialogo.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(ContextCompat.getColor(host, R.color.danger_red))
    }
}
