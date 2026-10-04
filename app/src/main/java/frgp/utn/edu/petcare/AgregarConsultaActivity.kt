package frgp.utn.edu.petcare

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.Spinner
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import java.time.LocalDate

class AgregarConsultaActivity : AppCompatActivity() {

    private var fecha: LocalDate? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.agregar_consulta)

        findViewById<Toolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }

        val spPaciente = findViewById<Spinner>(R.id.spPaciente)
        val spTipo = findViewById<Spinner>(R.id.spTipo)
        val pacientes = PacientesRepo.pacientes
        spPaciente.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item, pacientes.map { it.nombre }
        )
        spTipo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, AgendaRepo.tipos)

        val preseleccionado = intent.getIntExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, -1)
        val idx = pacientes.indexOfFirst { it.id == preseleccionado }
        if (idx >= 0) spPaciente.setSelection(idx)

        val etFecha = findViewById<EditText>(R.id.etFecha)
        etFecha.setOnClickListener {
            val base = fecha ?: LocalDate.now()
            DatePickerDialog(this, { _, y, m, d ->
                fecha = LocalDate.of(y, m + 1, d)
                etFecha.setText(Fechas.corta(fecha!!))
                etFecha.error = null
            }, base.year, base.monthValue - 1, base.dayOfMonth).show()
        }

        val etHora = findViewById<EditText>(R.id.etHora)
        etHora.setOnClickListener {
            TimePickerDialog(this, { _, h, m ->
                etHora.setText(String.format("%02d:%02d", h, m))
                etHora.error = null
            }, 9, 0, true).show()
        }

        val etMotivo = findViewById<EditText>(R.id.etMotivo)
        val etNotas = findViewById<EditText>(R.id.etNotas)

        findViewById<android.view.View>(R.id.btnGuardar).setOnClickListener {
            var ok = true
            if (fecha == null) { etFecha.error = "Requerido"; ok = false }
            if (etHora.text.isBlank()) { etHora.error = "Requerido"; ok = false }
            if (etMotivo.text.isBlank()) { etMotivo.error = "Requerido"; ok = false }
            if (!ok) return@setOnClickListener

            val paciente = pacientes[spPaciente.selectedItemPosition]
            val tipo = spTipo.selectedItem as String
            val motivo = etMotivo.text.toString().trim()
            val notas = etNotas.text.toString().trim()
            val f = fecha!!

            // Una consulta de una fecha pasada queda registrada como realizada; las demás, como turno pendiente
            val estado = if (f.isBefore(LocalDate.now())) EstadoEvento.COMPLETADO else EstadoEvento.PENDIENTE
            AgendaRepo.agregar(paciente.id, tipo, motivo, f, etHora.text.toString(), estado, notas, PerfilVetRepo.nombre)
            registrarEnCarnet(paciente.nombre, tipo, motivo, notas, Fechas.corta(f))

            Toast.makeText(this, R.string.consulta_guardada, Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    /** Las vacunas y tratamientos cargados por el veterinario aparecen en el carnet de salud del dueño. */
    private fun registrarEnCarnet(paciente: String, tipo: String, motivo: String, notas: String, fecha: String) {
        val detalle = notas.ifEmpty { "Registrado por el veterinario" }
        when (tipo) {
            "Vacuna" -> SaludRepo.registros.add(
                0, RegistroSalud(TipoRegistro.VACUNA, paciente, motivo, detalle, fecha, "Al día")
            )
            "Tratamiento" -> SaludRepo.registros.add(
                0, RegistroSalud(TipoRegistro.TRATAMIENTO, paciente, motivo, detalle, "Desde $fecha", "Activo")
            )
        }
    }
}
