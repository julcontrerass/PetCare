package frgp.utn.edu.petcare

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import java.time.LocalDate

class AgregarConsultaActivity : AppCompatActivity() {

    private var fecha: LocalDate? = null
    private var mascotasDuenoEncontrado = listOf<Paciente>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.agregar_consulta)

        VetUi.barras(this)
        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }

        val spPaciente = findViewById<Spinner>(R.id.spPaciente)
        val spTipo = findViewById<Spinner>(R.id.spTipo)
        val pacientes = PacientesRepo.pacientes

        spPaciente.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item, pacientes.map { "${it.nombre} (${it.propietario})" }
        )
        spTipo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, AgendaRepo.tipos)

        // Preselección por intent si viene de DetallePaciente
        val preseleccionado = intent.getIntExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, -1)
        val idx = pacientes.indexOfFirst { it.id == preseleccionado }
        if (idx >= 0) spPaciente.setSelection(idx)

        // Elementos de Búsqueda y Nuevo Dueño
        val etBuscarDueno = findViewById<EditText>(R.id.etBuscarDueno)
        val btnBuscarDueno = findViewById<View>(R.id.btnBuscarDueno)
        val layoutDuenoEncontrado = findViewById<LinearLayout>(R.id.layoutDuenoEncontrado)
        val tvDuenoInfo = findViewById<TextView>(R.id.tvDuenoInfo)
        val spMascotasDueno = findViewById<Spinner>(R.id.spMascotasDueno)

        val btnToggleNuevoDueno = findViewById<MaterialButton>(R.id.btnToggleNuevoDueno)
        val layoutNuevoDueno = findViewById<LinearLayout>(R.id.layoutNuevoDueno)

        val etNuevoNombreDueno = findViewById<EditText>(R.id.etNuevoNombreDueno)
        val etNuevoDniDueno = findViewById<EditText>(R.id.etNuevoDniDueno)
        val etNuevoTelefonoDueno = findViewById<EditText>(R.id.etNuevoTelefonoDueno)
        val etNuevoEmailDueno = findViewById<EditText>(R.id.etNuevoEmailDueno)

        val etNuevoNombreMascota = findViewById<EditText>(R.id.etNuevoNombreMascota)
        val spNuevoEspecie = findViewById<Spinner>(R.id.spNuevoEspecie)
        val spNuevoSexo = findViewById<Spinner>(R.id.spNuevoSexo)
        val etNuevaRazaMascota = findViewById<EditText>(R.id.etNuevaRazaMascota)

        spNuevoEspecie.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, listOf("Perro", "Gato", "Otro"))
        spNuevoSexo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, listOf("Macho", "Hembra"))

        // Acción Búsqueda de Dueño por DNI o Email
        btnBuscarDueno.setOnClickListener {
            val q = etBuscarDueno.text.toString().trim()
            if (q.isBlank()) {
                Toast.makeText(this, "Ingresá un DNI o Email para buscar", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val coincidentes = pacientes.filter { p ->
                p.email.equals(q, ignoreCase = true) ||
                p.propietario.contains(q, ignoreCase = true) ||
                p.telefono.contains(q)
            }

            if (coincidentes.isNotEmpty()) {
                mascotasDuenoEncontrado = coincidentes
                layoutDuenoEncontrado.visibility = View.VISIBLE
                layoutNuevoDueno.visibility = View.GONE
                tvDuenoInfo.text = "Dueño encontrado: ${coincidentes.first().propietario} (${coincidentes.first().email})"

                spMascotasDueno.adapter = ArrayAdapter(
                    this, android.R.layout.simple_spinner_dropdown_item, coincidentes.map { "${it.nombre} (${it.razaYSexo})" }
                )
                Toast.makeText(this, "Dueño encontrado con ${coincidentes.size} mascota(s)", Toast.LENGTH_SHORT).show()
            } else {
                layoutDuenoEncontrado.visibility = View.GONE
                layoutNuevoDueno.visibility = View.VISIBLE
                if (q.contains("@")) etNuevoEmailDueno.setText(q) else etNuevoDniDueno.setText(q)
                Toast.makeText(this, "No se encontró dueño con ese dato. Completá el formulario para registrarlo.", Toast.LENGTH_LONG).show()
            }
        }

        // Toggle Formulario Nuevo Dueño
        btnToggleNuevoDueno.setOnClickListener {
            if (layoutNuevoDueno.visibility == View.VISIBLE) {
                layoutNuevoDueno.visibility = View.GONE
            } else {
                layoutNuevoDueno.visibility = View.VISIBLE
                layoutDuenoEncontrado.visibility = View.GONE
            }
        }

        // Pickers de Fecha y Hora (Nativos y totalmente estables)
        val etFecha = findViewById<EditText>(R.id.etFecha)
        etFecha.setOnClickListener {
            val base = fecha ?: LocalDate.now()
            val dpd = DatePickerDialog(this, { _, y, m, d ->
                val seleccionada = LocalDate.of(y, m + 1, d)
                val hoy = LocalDate.now()

                if (seleccionada.isBefore(hoy)) {
                    Toast.makeText(this, "No podés seleccionar una fecha pasada", Toast.LENGTH_SHORT).show()
                    etFecha.error = "Fecha pasada no permitida"
                    return@DatePickerDialog
                }

                fecha = seleccionada
                etFecha.setText(Fechas.corta(fecha!!))
                etFecha.error = null
            }, base.year, base.monthValue - 1, base.dayOfMonth)

            dpd.datePicker.minDate = System.currentTimeMillis() - 1000
            dpd.show()
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

        // Acción Guardar Consulta
        findViewById<View>(R.id.btnGuardar).setOnClickListener {
            var ok = true
            if (fecha == null) { etFecha.error = "Requerido"; ok = false }
            if (etHora.text.isBlank()) { etHora.error = "Requerido"; ok = false }
            if (etMotivo.text.isBlank()) { etMotivo.error = "Requerido"; ok = false }
            if (!ok) return@setOnClickListener

            var pacienteElegido: Paciente? = null

            // 1. Si está activo el formulario de nuevo dueño y mascota
            if (layoutNuevoDueno.visibility == View.VISIBLE) {
                val nomDueno = etNuevoNombreDueno.text.toString().trim()
                val nomMascota = etNuevoNombreMascota.text.toString().trim()
                if (nomDueno.isBlank()) { etNuevoNombreDueno.error = "Requerido"; return@setOnClickListener }
                if (nomMascota.isBlank()) { etNuevoNombreMascota.error = "Requerido"; return@setOnClickListener }

                pacienteElegido = PacientesRepo.agregar(
                    Paciente(
                        id = 0,
                        nombre = nomMascota,
                        especie = spNuevoEspecie.selectedItem.toString(),
                        raza = etNuevaRazaMascota.text.toString().trim().ifBlank { spNuevoEspecie.selectedItem.toString() },
                        sexo = spNuevoSexo.selectedItem.toString(),
                        nacimiento = "Sin datos",
                        fotoRes = R.drawable.ic_dog,
                        peso = "Sin datos",
                        microchip = "Sin datos",
                        color = "Sin datos",
                        observaciones = "Sin observaciones",
                        propietario = nomDueno,
                        direccion = "Sin datos",
                        telefono = etNuevoTelefonoDueno.text.toString().trim().ifBlank { "Sin datos" },
                        email = etNuevoEmailDueno.text.toString().trim().ifBlank { "Sin datos" },
                        ultimaConsulta = "Sin consultas",
                        proximoRecordatorio = "Sin recordatorios"
                    )
                )
            }
            // 2. Si se buscó un dueño existente
            else if (layoutDuenoEncontrado.visibility == View.VISIBLE && mascotasDuenoEncontrado.isNotEmpty()) {
                val idxMascota = spMascotasDueno.selectedItemPosition
                pacienteElegido = mascotasDuenoEncontrado.getOrNull(idxMascota)
            }
            // 3. Selección de la lista general
            else {
                val idxGen = spPaciente.selectedItemPosition
                pacienteElegido = pacientes.getOrNull(idxGen)
            }

            if (pacienteElegido == null) {
                Toast.makeText(this, "Seleccioná o registrá una mascota", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val tipo = spTipo.selectedItem as String
            val motivo = etMotivo.text.toString().trim()
            val notas = etNotas.text.toString().trim()
            val f = fecha!!

            val estado = if (f.isBefore(LocalDate.now())) EstadoEvento.COMPLETADO else EstadoEvento.PENDIENTE
            AgendaRepo.agregar(pacienteElegido.id, tipo, motivo, f, etHora.text.toString(), estado, notas, PerfilVetRepo.nombre)
            registrarEnCarnet(pacienteElegido.nombre, tipo, motivo, notas, Fechas.corta(f))

            Toast.makeText(this, R.string.consulta_guardada, Toast.LENGTH_SHORT).show()
            finish()
        }
    }

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
