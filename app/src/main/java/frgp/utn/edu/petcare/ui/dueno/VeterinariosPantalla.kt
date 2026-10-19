package frgp.utn.edu.petcare.ui.dueno

import android.app.DatePickerDialog
import android.graphics.Typeface
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.data.repositorio.DuenoRepo
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.model.VeterinarioAcceso
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.Avatares
import frgp.utn.edu.petcare.ui.common.Efectos
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import kotlinx.coroutines.launch

/** Veterinarios con acceso a las mascotas: se puede revocar, restablecer o autorizar a uno nuevo. */
class VeterinariosPantalla(host: DuenoActivity) : Pantalla(host) {

    private enum class Filtro(val chipId: Int, val estado: EstadoAcceso?) {
        TODOS(R.id.btnFiltroTodos, null),
        ACTIVOS(R.id.btnFiltroActivos, EstadoAcceso.ACTIVO),
        INACTIVOS(R.id.btnFiltroInactivos, EstadoAcceso.INACTIVO)
    }

    private var filtro = Filtro.TODOS
    private var consulta = ""

    fun mostrar() {
        host.mostrarContenido(R.layout.pantalla_veterinarios, -1)
        filtro = Filtro.TODOS
        consulta = ""

        alTocar(R.id.btnBack) { host.irAHome() }
        Filtro.entries.forEach { f ->
            alTocar(f.chipId) {
                filtro = f
                dibujar()
            }
        }
        vista<EditText>(R.id.etBuscar)?.apply {
            setText("")
            addTextChangedListener(alCambiarTexto {
                consulta = it.trim()
                dibujar()
            })
        }
        alTocarConRebote(R.id.btnAgregarVeterinario) { autorizarNuevo() }
        alTocar(R.id.btnHistorialPermisos) { mostrarHistorial() }
        dibujar()
    }

    /** Opciones de duración del permiso; null = sin vencimiento. */
    private fun elegirVencimiento(titulo: String, alElegir: (LocalDate?) -> Unit) {
        val hoy = LocalDate.now()
        val opciones = listOf<Pair<String, LocalDate?>>(
            "Sin vencimiento" to null,
            "1 mes" to hoy.plusMonths(1),
            "3 meses" to hoy.plusMonths(3),
            "6 meses" to hoy.plusMonths(6),
            "1 año" to hoy.plusYears(1)
        )
        AlertDialog.Builder(host)
            .setTitle(titulo)
            .setItems((opciones.map { (nombre, fecha) -> nombre + (fecha?.let { " (hasta ${Fechas.corta(it)})" } ?: "") } +
                "Elegir una fecha…").toTypedArray()) { _, i ->
                if (i < opciones.size) alElegir(opciones[i].second)
                else DatePickerDialog(host, { _, a, m, d -> alElegir(LocalDate.of(a, m + 1, d)) },
                    hoy.year, hoy.monthValue - 1, hoy.dayOfMonth).apply {
                    datePicker.minDate = java.time.ZoneId.systemDefault().let {
                        hoy.atStartOfDay(it).toInstant().toEpochMilli()
                    }
                }.show()
            }
            .setNegativeButton(R.string.btn_cancelar, null)
            .show()
    }

    /** Quién autorizó, pidió o sacó cada permiso y cuándo. */
    private fun mostrarHistorial() {
        val lista = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            val margen = dp(20)
            setPadding(margen, dp(8), margen, margen)
        }
        val cargando = TextView(host).apply {
            text = "Cargando…"
            setTextColor(ContextCompat.getColor(host, R.color.text_gray))
        }
        lista.addView(cargando)
        AlertDialog.Builder(host)
            .setTitle("Historial de permisos")
            .setView(ScrollView(host).apply { addView(lista) })
            .setPositiveButton("Cerrar", null)
            .show()
        host.lifecycleScope.launch {
            val entradas = runCatching { DuenoRepo.historialDePermisos() }.getOrNull()
            lista.removeAllViews()
            if (entradas.isNullOrEmpty()) {
                lista.addView(TextView(host).apply {
                    text = if (entradas == null) "No se pudo cargar el historial" else "Todavía no hay movimientos"
                    setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                })
                return@launch
            }
            entradas.forEach { e ->
                lista.addView(TextView(host).apply {
                    text = e.evento
                    textSize = 14f
                    setTypeface(typeface, Typeface.BOLD)
                    setTextColor(ContextCompat.getColor(host, R.color.black))
                    setPadding(0, dp(10), 0, 0)
                })
                lista.addView(TextView(host).apply {
                    text = "${e.veterinario} · ${e.mascota}" + (e.venceEl?.let { " · hasta ${Fechas.corta(it)}" } ?: "") +
                        "\n${e.actor} · ${Fechas.corta(e.cuando.toLocalDate())}, " + "%02d:%02d".format(e.cuando.hour, e.cuando.minute)
                    textSize = 12f
                    setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                })
            }
        }
    }

    private fun alCambiarTexto(accion: (String) -> Unit) = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = accion(s.toString())
        override fun afterTextChanged(s: Editable?) {}
    }

    private fun dibujar() {
        val lista = vista<LinearLayout>(R.id.listaVeterinarios) ?: return
        lista.removeAllViews()

        val q = consulta.lowercase()
        val filtrados = DuenoRepo.autorizados.filter { vet ->
            (filtro.estado == null || vet.estado == filtro.estado) &&
                (q.isEmpty() || (listOf(vet.nombre, vet.usuario, vet.email, vet.matricula) + vet.mascotas)
                    .any { it.lowercase().contains(q) })
        }
        val conAcceso = DuenoRepo.autorizados.count { it.tieneAcceso }
        texto(R.id.tvVetsCount, if (conAcceso == 1) "1 con acceso a tus mascotas" else "$conAcceso con acceso a tus mascotas")

        Filtro.entries.forEach { f ->
            val chip = vista<TextView>(f.chipId) ?: return@forEach
            val activo = f == filtro
            chip.setBackgroundResource(if (activo) R.drawable.bg_pill_teal else R.drawable.bg_pill_white)
            chip.setTextColor(ContextCompat.getColor(host, if (activo) R.color.white else R.color.text_gray))
        }

        vista<View>(R.id.tvSinResultados)?.visibility = if (filtrados.isEmpty()) View.VISIBLE else View.GONE
        filtrados.forEach { lista.addView(tarjeta(it, lista)) }
    }

    private fun tarjeta(vet: VeterinarioAcceso, padre: ViewGroup): View {
        val tarjeta = host.layoutInflater.inflate(R.layout.item_veterinario, padre, false)
        val activo = vet.tieneAcceso

        val sinTitulo = vet.nombre.replaceFirst(Regex("^Dra?\\.\\s*"), "")
        val inicial = tarjeta.findViewById<TextView>(R.id.tvInicial)
        inicial.text = sinTitulo.take(1).uppercase().ifEmpty { "?" }
        Avatares.conRespaldo(tarjeta.findViewById(R.id.ivFotoVet), vet.fotoPath, inicial)
        tarjeta.findViewById<TextView>(R.id.tvNombre).text = vet.nombre
        val turnos = DuenoRepo.turnosDeVeterinario(vet)
        tarjeta.findViewById<TextView>(R.id.tvDatos).text =
            "${vet.especialidad} · ${vet.matricula} · " + if (turnos == 1) "1 turno" else "$turnos turnos"

        tarjeta.findViewById<TextView>(R.id.tvEstado).apply {
            text = when {
                activo && vet.venceEl != null -> "Con acceso hasta ${Fechas.corta(vet.venceEl!!)}"
                activo -> "Con acceso"
                vet.vencido -> "Venció el ${Fechas.corta(vet.venceEl!!)}"
                else -> "Sin acceso"
            }
            setBackgroundResource(if (activo) R.drawable.bg_chip_ok else R.drawable.bg_chip_danger)
            setTextColor(ContextCompat.getColor(host, if (activo) R.color.success_green else R.color.danger_red))
        }

        val hayMascotas = vet.mascotas.isNotEmpty()
        val llMascotas = tarjeta.findViewById<LinearLayout>(R.id.llMascotas)
        tarjeta.findViewById<View>(R.id.tvMascotasLabel).visibility = if (hayMascotas) View.VISIBLE else View.GONE
        llMascotas.visibility = if (hayMascotas) View.VISIBLE else View.GONE
        vet.mascotas.forEach { nombre ->
            llMascotas.addView(TextView(host).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { marginEnd = dp(6) }
                setBackgroundResource(R.drawable.bg_chip_neutral)
                setPadding(dp(10), dp(4), dp(10), dp(4))
                text = nombre
                setTextColor(ContextCompat.getColor(host, R.color.teal_dark))
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
            })
        }

        val proximo = DuenoRepo.proximoTurnoDeVeterinario(vet)
        tarjeta.findViewById<TextView>(R.id.tvTurno).text = proximo?.let {
            "Próximo turno: ${it.categoria} de ${it.mascota} · ${it.fecha.dayOfMonth} ${Fechas.mesCorto(it.fecha.monthValue)}, ${it.hora}"
        } ?: "Sin turnos próximos"

        tarjeta.findViewById<TextView>(R.id.btnAccion).apply {
            if (activo) {
                text = "Revocar acceso"
                setTextColor(ContextCompat.getColor(host, R.color.danger_red))
                setOnClickListener {
                    AlertDialog.Builder(host)
                        .setTitle("Revocar acceso")
                        .setMessage("${vet.nombre} dejará de ver las fichas de tus mascotas hasta que agendes un nuevo turno.")
                        .setPositiveButton("Revocar") { _, _ ->
                            DuenoRepo.revocarAcceso(vet)
                            toast(host.getString(R.string.vet_desautorizado_exito, vet.nombre))
                            dibujar()
                        }
                        .setNegativeButton(R.string.btn_cancelar, null)
                        .show()
                }
            } else {
                text = "Restablecer acceso"
                setTextColor(ContextCompat.getColor(host, R.color.primary_teal))
                setOnClickListener {
                    elegirVencimiento("¿Por cuánto tiempo?") { hasta ->
                        DuenoRepo.restablecerAcceso(vet, hasta)
                        toast(host.getString(R.string.vet_autorizado_exito, vet.nombre))
                        dibujar()
                    }
                }
            }
        }
        tarjeta.findViewById<TextView>(R.id.btnVencimiento).apply {
            visibility = if (activo) View.VISIBLE else View.GONE
            setOnClickListener {
                elegirVencimiento("Vencimiento del permiso") { hasta ->
                    DuenoRepo.cambiarVencimiento(vet, hasta)
                    toast(if (hasta == null) "El permiso ya no vence" else "El permiso vence el ${Fechas.corta(hasta)}")
                    dibujar()
                }
            }
        }
        return tarjeta
    }

    /** Busca en el catálogo por usuario, correo o matrícula y autoriza al veterinario elegido. */
    private fun autorizarNuevo() {
        val contenedor = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            val margen = dp(20)
            setPadding(margen, margen, margen, margen)
        }
        contenedor.addView(TextView(host).apply {
            text = "Buscá por usuario, mail o matrícula para autorizar a un veterinario:"
            textSize = 13f
            setTextColor(ContextCompat.getColor(host, R.color.text_gray))
        })
        val buscador = EditText(host).apply {
            setHint(R.string.buscar_vet_hint)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(10) }
        }
        contenedor.addView(buscador)
        val resultados = LinearLayout(host).apply { orientation = LinearLayout.VERTICAL }
        contenedor.addView(ScrollView(host).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(220))
                .apply { topMargin = dp(12) }
            addView(resultados)
        })

        val dialogo = AlertDialog.Builder(host)
            .setTitle(R.string.dialog_autorizar_veterinario)
            .setView(contenedor)
            .setNegativeButton(R.string.btn_cancelar, null)
            .create()

        fun actualizarResultados() {
            resultados.removeAllViews()
            val candidatos = DuenoRepo.candidatosAAutorizar(buscador.text.toString())
            if (candidatos.isEmpty()) {
                resultados.addView(TextView(host).apply {
                    setText(R.string.sin_veterinarios_disponibles)
                    textSize = 13f
                    setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                    setPadding(0, dp(16), 0, dp(16))
                    gravity = Gravity.CENTER
                })
                return
            }
            candidatos.forEach { vet -> resultados.addView(filaCandidato(vet, dialogo)) }
        }
        buscador.addTextChangedListener(alCambiarTexto { actualizarResultados() })
        dialogo.show()
        actualizarResultados()
    }

    private fun filaCandidato(vet: VeterinarioAcceso, dialogo: AlertDialog): View {
        val fila = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
        }
        val contenido = LinearLayout(host).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(8), 0, dp(8))
        }
        val textos = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        textos.addView(TextView(host).apply {
            text = "${vet.nombre} (${vet.usuario})"
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(ContextCompat.getColor(host, R.color.black))
        })
        textos.addView(TextView(host).apply {
            text = "${vet.email} • ${vet.matricula}"
            textSize = 12f
            setTextColor(ContextCompat.getColor(host, R.color.text_gray))
        })
        contenido.addView(textos)
        contenido.addView(MaterialButton(host).apply {
            setText(R.string.btn_autorizar)
            textSize = 12f
            isAllCaps = false
            backgroundTintList = ContextCompat.getColorStateList(host, R.color.primary_teal)
            setOnClickListener {
                dialogo.dismiss()
                elegirVencimiento("¿Por cuánto tiempo?") { hasta ->
                    DuenoRepo.autorizarVeterinario(vet, hasta)
                    toast(host.getString(R.string.vet_autorizado_exito, vet.nombre))
                    dibujar()
                }
            }
        })
        fila.addView(contenido)
        fila.addView(View(host).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
            setBackgroundColor(ContextCompat.getColor(host, R.color.light_gray))
        })
        return fila
    }
}

/** Solicitudes de acceso de veterinarios a las mascotas del dueño. */
class SolicitudesPantalla(host: DuenoActivity) : Pantalla(host) {

    fun mostrar() {
        host.mostrarContenido(R.layout.pantalla_solicitudes, -1)
        alTocar(R.id.btnBack) { host.irAHome() }

        vista<androidx.recyclerview.widget.RecyclerView>(R.id.rvSolicitudesDueno)?.adapter =
            frgp.utn.edu.petcare.ui.veterinario.SolicitudesAdapter(DuenoRepo.solicitudes) { item, estado ->
                val aceptada = estado == frgp.utn.edu.petcare.data.repositorio.SolicitudItem.Estado.ACEPTADA
                DuenoRepo.resolverSolicitud(item, aceptada)
                toast(if (aceptada) "${item.solicitante} fue autorizado/a" else "Solicitud rechazada")
                actualizarContador()
            }
        actualizarContador()
    }

    private fun actualizarContador() {
        val pendientes = DuenoRepo.solicitudes.count { it.estado == frgp.utn.edu.petcare.data.repositorio.SolicitudItem.Estado.PENDIENTE }
        texto(
            R.id.tvSolicitudesCount,
            when (pendientes) {
                0 -> "Sin solicitudes pendientes"
                1 -> "1 pendiente"
                else -> "$pendientes pendientes"
            }
        )
        val sinItems = DuenoRepo.solicitudes.isEmpty()
        vista<View>(R.id.emptySolicitudes)?.let { vacio ->
            vacio.visibility = if (sinItems) View.VISIBLE else View.GONE
            vacio.findViewById<android.widget.ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_key)
            vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "No hay solicitudes"
            vacio.findViewById<TextView>(R.id.tvEmptyMessage).text =
                "Los veterinarios con turno tuyo ya ven la ficha de tu mascota sin pedir permiso"
        }
        vista<View>(R.id.rvSolicitudesDueno)?.visibility = if (sinItems) View.GONE else View.VISIBLE
    }
}
