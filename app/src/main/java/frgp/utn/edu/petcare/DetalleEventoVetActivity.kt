package frgp.utn.edu.petcare

import android.content.Intent
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.data.Imagenes
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.time.LocalDate

class DetalleEventoVetActivity : BaseActivity() {

    companion object {
        const val EXTRA_EVENTO_ID = "evento_id"

        /** Ícono según el tipo de evento. */
        fun iconoDe(tipo: String): Int = when (tipo) {
            "Vacuna" -> R.drawable.ic_syringe
            "Cirugía" -> R.drawable.ic_cirugia
            "Control" -> R.drawable.ic_pulse
            "Tratamiento" -> R.drawable.ic_activity
            "Consulta" -> R.drawable.ic_medical
            else -> R.drawable.ic_list
        }

        /** Muestra el diálogo de edición/alta de un evento. */
        fun mostrarFormulario(
            activity: AppCompatActivity, evento: EventoVet, alGuardar: () -> Unit
        ) {
            val ctx = activity
            val layout = LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(48, 32, 48, 8)
            }
            fun campo(hint: String, valor: String) = EditText(ctx).apply {
                this.hint = hint
                setText(valor)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 12, 0, 12) }
            }

            val spTipo = Spinner(ctx).apply {
                adapter = ArrayAdapter(ctx, android.R.layout.simple_spinner_dropdown_item, AgendaRepo.tipos)
                setSelection(AgendaRepo.tipos.indexOf(evento.tipo).coerceAtLeast(0))
            }
            val etMotivo = campo("Motivo", evento.motivo)
            var fecha = evento.fecha
            val etFecha = campo("Fecha", Fechas.corta(fecha)).apply { isFocusable = false }
            val etHora = campo("Hora", evento.hora).apply { isFocusable = false }
            etFecha.setOnClickListener {
                SelectorFechaVet.mostrar(ctx, fecha) { nuevaFecha ->
                    fecha = nuevaFecha
                    etFecha.setText(Fechas.corta(fecha))
                    val hora = etHora.text.toString()
                    if (hora.isNotBlank() && DisponibilidadVet.validar(nuevaFecha, hora, evento.id) != null) {
                        etHora.setText("")
                        Avisos.mostrar(ctx, "Elegí otro horario para ese día")
                    }
                }
            }
            etHora.setOnClickListener {
                SelectorHoraVet.mostrar(ctx, fecha, etHora.text.toString().ifBlank { null }, evento.id) { hora ->
                    etHora.setText(hora)
                    etHora.error = null
                }
            }
            val etNotas = campo("Notas", evento.notas).apply {
                minLines = 3
                gravity = android.view.Gravity.TOP
            }
            listOf(spTipo, etMotivo, etFecha, etHora, etNotas).forEach { layout.addView(it) }

            val dialog = AlertDialog.Builder(ctx)
                .setTitle("Editar turno")
                .setView(android.widget.ScrollView(ctx).apply { addView(layout) })
                .setPositiveButton("Guardar", null)
                .setNegativeButton("Cancelar", null)
                .create()
            dialog.setOnShowListener {
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                    if (etMotivo.text.isBlank()) {
                        etMotivo.error = "Requerido"
                        return@setOnClickListener
                    }
                    val hora = etHora.text.toString()
                    // Si no se movió el turno no se revalida (puede ser de hoy y ya estar en curso)
                    val cambioHorario = fecha != evento.fecha || hora != evento.hora
                    val problema = if (hora.isBlank()) "Elegí un horario"
                    else if (cambioHorario) DisponibilidadVet.validar(fecha, hora, evento.id) else null
                    if (problema != null) {
                        etHora.error = problema
                        Avisos.mostrar(ctx, problema)
                        return@setOnClickListener
                    }
                    evento.tipo = spTipo.selectedItem as String
                    evento.motivo = etMotivo.text.toString().trim()
                    evento.fecha = fecha
                    evento.hora = etHora.text.toString()
                    evento.notas = etNotas.text.toString().trim()
                    AgendaRepo.guardar(evento)
                    alGuardar()
                    dialog.dismiss()
                }
            }
            dialog.show()
        }
    }

    private lateinit var evento: EventoVet

    override fun onResume() {
        super.onResume()
        if (isFinishing || !::evento.isInitialized) return
        mostrar()
        // El informe se escribe en otra pantalla: al volver se pide de nuevo para mostrar lo último
        mostrarInforme(InformesRepo.obtener(evento.pacienteId, evento.id))
        lifecycleScope.launch {
            runCatching { InformesRepo.cargar(evento.pacienteId, evento.id) }.onSuccess { mostrarInforme(it) }
        }
    }

    /** Muestra lo que el veterinario escribió en el informe de este turno. */
    private fun mostrarInforme(informe: InformeData) {
        val texto = listOf(
            "Motivo" to informe.motivo, "Diagnóstico" to informe.diagnostico, "Tratamiento" to informe.tratamiento
        ).filter { it.second.isNotBlank() }.joinToString("\n\n") { (titulo, valor) -> "$titulo\n$valor" }
        findViewById<View>(R.id.seccionInforme).visibility = if (informe.vacio) View.GONE else View.VISIBLE
        findViewById<TextView>(R.id.tvInforme).text = texto
        val pendiente = evento.estado == EstadoEvento.PENDIENTE
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnIniciarTurno).text =
            if (pendiente && !informe.vacio) "Continuar informe" else "Iniciar turno"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.detalle_evento_vet)

        val id = intent.getStringExtra(EXTRA_EVENTO_ID)
        val encontrado = AgendaRepo.porId(id)
        if (encontrado == null) {
            Avisos.mostrar(this, "No se encontró el turno")
            finish()
            return
        }
        evento = encontrado

        VetUi.barras(this)
        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }
        findViewById<View>(R.id.cardPaciente).setOnClickListener {
            startActivity(
                Intent(this, DetallePacienteActivity::class.java)
                    .putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, evento.pacienteId)
            )
        }
        findViewById<View>(R.id.btnIniciarTurno).setOnClickListener {
            startActivity(
                Intent(this, DetallePacienteActivity::class.java)
                    .putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, evento.pacienteId)
                    .putExtra(EXTRA_EVENTO_ID, evento.id)
            )
        }
        findViewById<View>(R.id.btnEditar).setOnClickListener {
            mostrarFormulario(this, evento) {
                Avisos.mostrar(this, "Turno actualizado")
                mostrar()
            }
        }
        findViewById<View>(R.id.btnCompletar).setOnClickListener {
            AgendaRepo.cambiarEstado(evento, EstadoEvento.COMPLETADO)
            Avisos.mostrar(this, "Turno marcado como completado")
            mostrar()
        }
        findViewById<View>(R.id.btnCancelarTurno).setOnClickListener {
            Avisos.confirmar(
                this, "¿Cancelar este turno?",
                "Vas a cancelar el turno de ${PacientesRepo.nombreDe(evento.pacienteId)} del " +
                    "${Fechas.corta(evento.fecha)} a las ${evento.hora} hs. El dueño va a recibir un aviso.",
                textoAceptar = "Cancelar turno"
            ) {
                AgendaRepo.cambiarEstado(evento, EstadoEvento.CANCELADO)
                Avisos.mostrar(this, "Turno cancelado")
                mostrar()
            }
        }
        mostrar()
    }

    private fun mostrar() {
        val p = PacientesRepo.porId(evento.pacienteId)
        findViewById<TextView>(R.id.tvTitulo).text = evento.motivo
        findViewById<TextView>(R.id.tvTipo).text = evento.tipo
        findViewById<TextView>(R.id.tvEstado).text = evento.estado.etiqueta
        findViewById<ImageView>(R.id.ivTipo).setImageResource(iconoDe(evento.tipo))
        findViewById<TextView>(R.id.tvFecha).text = Fechas.relativa(evento.fecha)
        findViewById<TextView>(R.id.tvHora).text = "${evento.hora} hs"
        findViewById<TextView>(R.id.tvFechaHora).text = "${Fechas.corta(evento.fecha)} · ${evento.hora} hs"
        findViewById<TextView>(R.id.tvVeterinario).text = evento.veterinario
        findViewById<TextView>(R.id.tvNotas).text = evento.notas.ifBlank { "Sin notas" }

        findViewById<ImageView>(R.id.ivPaciente).let {
            it.setImageResource(R.drawable.ic_dog)
            Imagenes.mostrar(it, null, p?.fotoPath)
        }
        findViewById<TextView>(R.id.tvPaciente).text = p?.nombre ?: "Mascota"
        findViewById<TextView>(R.id.tvPacienteRaza).text = p?.razaYSexo.orEmpty()
        findViewById<TextView>(R.id.tvPropietario).text = "Propietario/a: ${p?.propietario ?: "Sin datos"}"

        val pendiente = evento.estado == EstadoEvento.PENDIENTE
        findViewById<View>(R.id.btnIniciarTurno).visibility = if (pendiente) View.VISIBLE else View.GONE
        findViewById<View>(R.id.btnCompletar).visibility = if (pendiente) View.VISIBLE else View.GONE
        findViewById<View>(R.id.btnCancelarTurno).visibility = if (pendiente) View.VISIBLE else View.GONE
    }
}
