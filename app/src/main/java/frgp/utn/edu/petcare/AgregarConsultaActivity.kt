package frgp.utn.edu.petcare

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
        val etHora = findViewById<EditText>(R.id.etHora)
        etFecha.setOnClickListener {
            SelectorFechaVet.mostrar(this, fecha) { elegida ->
                fecha = elegida
                etFecha.setText(Fechas.corta(elegida))
                etFecha.error = null
                // Si el horario ya cargado no sirve para el nuevo día, hay que elegirlo de nuevo
                val hora = etHora.text.toString()
                if (hora.isNotBlank() && DisponibilidadVet.validar(elegida, hora) != null) {
                    etHora.setText("")
                    Toast.makeText(this, "Elegí otro horario para ese día", Toast.LENGTH_SHORT).show()
                }
            }
        }

        etHora.setOnClickListener {
            val f = fecha
            if (f == null) {
                etFecha.error = "Elegí primero la fecha"
                Toast.makeText(this, "Elegí primero la fecha", Toast.LENGTH_SHORT).show()
            } else {
                SelectorHoraVet.mostrar(this, f, etHora.text.toString().ifBlank { null }, null) { hora ->
                    etHora.setText(hora)
                    etHora.error = null
                }
            }
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

            val problema = DisponibilidadVet.validar(fecha!!, etHora.text.toString())
            if (problema != null) {
                etHora.error = problema
                Toast.makeText(this, problema, Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

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
