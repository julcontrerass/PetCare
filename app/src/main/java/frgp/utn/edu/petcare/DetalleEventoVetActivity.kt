package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
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
                        Toast.makeText(ctx, "Elegí otro horario para ese día", Toast.LENGTH_SHORT).show()
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
                        Toast.makeText(ctx, problema, Toast.LENGTH_LONG).show()
                        return@setOnClickListener
                    }
                    evento.tipo = spTipo.selectedItem as String
                    evento.motivo = etMotivo.text.toString().trim()
                    evento.fecha = fecha
                    evento.hora = etHora.text.toString()
                    evento.notas = etNotas.text.toString().trim()
                    alGuardar()
                    dialog.dismiss()
                }
            }
            dialog.show()
        }
    }

    private lateinit var evento: EventoVet

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.detalle_evento_vet)

        val id = intent.getIntExtra(EXTRA_EVENTO_ID, -1)
        val encontrado = AgendaRepo.porId(id)
        if (encontrado == null) {
            Toast.makeText(this, "No se encontró el turno", Toast.LENGTH_SHORT).show()
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
                Toast.makeText(this, "Turno actualizado", Toast.LENGTH_SHORT).show()
                mostrar()
            }
        }
        findViewById<View>(R.id.btnCompletar).setOnClickListener {
            evento.estado = EstadoEvento.COMPLETADO
            Toast.makeText(this, "Turno marcado como completado", Toast.LENGTH_SHORT).show()
            mostrar()
        }
        findViewById<View>(R.id.btnCancelarTurno).setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Cancelar turno")
                .setMessage("¿Cancelar el turno de ${PacientesRepo.porId(evento.pacienteId).nombre}?")
                .setPositiveButton("Cancelar turno") { _, _ ->
                    evento.estado = EstadoEvento.CANCELADO
                    Toast.makeText(this, "Turno cancelado", Toast.LENGTH_SHORT).show()
                    mostrar()
                }
                .setNegativeButton("Volver", null)
                .show()
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

        findViewById<ImageView>(R.id.ivPaciente).setImageResource(p.fotoRes)
        findViewById<TextView>(R.id.tvPaciente).text = p.nombre
        findViewById<TextView>(R.id.tvPacienteRaza).text = p.razaYSexo
        findViewById<TextView>(R.id.tvPropietario).text = "Propietario/a: ${p.propietario}"

        val pendiente = evento.estado == EstadoEvento.PENDIENTE
        findViewById<View>(R.id.btnIniciarTurno).visibility = if (pendiente) View.VISIBLE else View.GONE
        findViewById<View>(R.id.btnCompletar).visibility = if (pendiente) View.VISIBLE else View.GONE
        findViewById<View>(R.id.btnCancelarTurno).visibility = if (pendiente) View.VISIBLE else View.GONE
    }
}
