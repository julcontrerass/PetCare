package frgp.utn.edu.petcare

import android.os.Bundle
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.ui.common.Avisos
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Servicios
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate

class AgregarConsultaActivity : BaseActivity() {

    /** Mascota que aparece al buscar un dueño: [paciente] es null si todavía no fue compartida con el veterinario. */
    private class Candidata(val mascotaId: String, val etiqueta: String, val paciente: Paciente?)

    private var fecha: LocalDate? = null
    private var candidatas = listOf<Candidata>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
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
        val preseleccionado = intent.getStringExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID)
        val idx = pacientes.indexOfFirst { it.id == preseleccionado }
        if (idx >= 0) spPaciente.setSelection(idx)

        // Elementos de búsqueda y nuevo dueño
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

        spNuevoEspecie.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, TiposMascota.TODOS)
        spNuevoSexo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, listOf("Macho", "Hembra"))

        // Búsqueda de un dueño por DNI o correo: primero entre mis pacientes y después en toda la plataforma
        btnBuscarDueno.setOnClickListener {
            val q = etBuscarDueno.text.toString().trim()
            if (q.isBlank()) {
                Avisos.mostrar(this, "Ingresá un DNI o Email para buscar")
                return@setOnClickListener
            }
            btnBuscarDueno.isEnabled = false
            lifecycleScope.launch {
                try {
                    val encontradas = buscarMascotas(q, pacientes)
                    if (encontradas.isNotEmpty()) {
                        candidatas = encontradas.map { it.candidata }
                        layoutDuenoEncontrado.visibility = View.VISIBLE
                        layoutNuevoDueno.visibility = View.GONE
                        tvDuenoInfo.text = encontradas.first().etiquetaDueno
                        spMascotasDueno.adapter = ArrayAdapter(
                            this@AgregarConsultaActivity, android.R.layout.simple_spinner_dropdown_item,
                            encontradas.map { it.candidata.etiqueta }
                        )
                        Avisos.mostrar(this@AgregarConsultaActivity, "Dueño encontrado con ${encontradas.size} mascota(s)")
                    } else {
                        candidatas = emptyList()
                        layoutDuenoEncontrado.visibility = View.GONE
                        layoutNuevoDueno.visibility = View.VISIBLE
                        if (q.contains("@")) etNuevoEmailDueno.setText(q) else etNuevoDniDueno.setText(q)
                        Avisos.mostrar(this@AgregarConsultaActivity, "No se encontró dueño con ese dato. Completá el formulario para registrarlo.")
                    }
                } catch (e: Exception) {
                    Avisos.error(this@AgregarConsultaActivity, Errores.mensaje(e))
                } finally {
                    btnBuscarDueno.isEnabled = true
                }
            }
        }

        // Toggle formulario nuevo dueño
        btnToggleNuevoDueno.setOnClickListener {
            if (layoutNuevoDueno.visibility == View.VISIBLE) {
                layoutNuevoDueno.visibility = View.GONE
            } else {
                layoutNuevoDueno.visibility = View.VISIBLE
                layoutDuenoEncontrado.visibility = View.GONE
            }
        }

        // Selectores de fecha y hora
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
                    Avisos.mostrar(this, "Elegí otro horario para ese día")
                }
            }
        }

        etHora.setOnClickListener {
            val f = fecha
            if (f == null) {
                etFecha.error = "Elegí primero la fecha"
                Avisos.mostrar(this, "Elegí primero la fecha")
            } else {
                SelectorHoraVet.mostrar(this, f, etHora.text.toString().ifBlank { null }, null) { hora ->
                    etHora.setText(hora)
                    etHora.error = null
                }
            }
        }

        val etMotivo = findViewById<EditText>(R.id.etMotivo)
        val etNotas = findViewById<EditText>(R.id.etNotas)

        findViewById<View>(R.id.btnGuardar).setOnClickListener {
            var ok = true
            if (fecha == null) { etFecha.error = "Requerido"; ok = false }
            if (etHora.text.isBlank()) { etHora.error = "Requerido"; ok = false }
            if (etMotivo.text.isBlank()) { etMotivo.error = "Requerido"; ok = false }
            if (!ok) return@setOnClickListener

            val problema = DisponibilidadVet.validar(fecha!!, etHora.text.toString())
            if (problema != null) {
                etHora.error = problema
                Avisos.mostrar(this, problema)
                return@setOnClickListener
            }

            var pacienteElegido: Paciente? = null

            // 1. Si está activo el formulario de nuevo dueño y mascota
            if (layoutNuevoDueno.visibility == View.VISIBLE) {
                val nomDueno = etNuevoNombreDueno.text.toString().trim()
                val nomMascota = etNuevoNombreMascota.text.toString().trim()
                if (nomDueno.isBlank()) { etNuevoNombreDueno.error = "Requerido"; return@setOnClickListener }
                if (nomMascota.isBlank()) { etNuevoNombreMascota.error = "Requerido"; return@setOnClickListener }

                pacienteElegido = PacientesRepo.agregarManual(
                    nombre = nomMascota,
                    especie = spNuevoEspecie.selectedItem.toString(),
                    raza = etNuevaRazaMascota.text.toString().trim(),
                    sexo = spNuevoSexo.selectedItem.toString(),
                    propietario = nomDueno,
                    telefono = etNuevoTelefonoDueno.text.toString().trim(),
                    email = etNuevoEmailDueno.text.toString().trim(),
                    dni = etNuevoDniDueno.text.toString().trim()
                )
            }
            // 2. Si se buscó un dueño existente
            else if (layoutDuenoEncontrado.visibility == View.VISIBLE && candidatas.isNotEmpty()) {
                val candidata = candidatas.getOrNull(spMascotasDueno.selectedItemPosition)
                if (candidata != null && candidata.paciente == null) {
                    pedirAcceso(candidata)
                    return@setOnClickListener
                }
                pacienteElegido = candidata?.paciente
            }
            // 3. Selección de la lista general
            else {
                pacienteElegido = pacientes.getOrNull(spPaciente.selectedItemPosition)
            }

            if (pacienteElegido == null) {
                Avisos.mostrar(this, "Seleccioná o registrá una mascota")
                return@setOnClickListener
            }

            val tipo = spTipo.selectedItem as String
            val motivo = etMotivo.text.toString().trim()
            val notas = etNotas.text.toString().trim()
            val f = fecha!!

            val estado = if (f.isBefore(LocalDate.now())) EstadoEvento.COMPLETADO else EstadoEvento.PENDIENTE
            AgendaRepo.agregar(pacienteElegido.id, tipo, motivo, f, etHora.text.toString(), estado, notas)
            registrarEnCarnet(pacienteElegido.id, tipo, motivo, notas, f)

            Avisos.mostrar(this, R.string.consulta_guardada)
            finish()
        }
    }

    private class Encontrada(val candidata: Candidata, val etiquetaDueno: String)

    /** Mascotas de un dueño buscado por correo o DNI. */
    private suspend fun buscarMascotas(q: String, propios: List<Paciente>): List<Encontrada> {
        val locales = propios.filter { p -> p.email.equals(q, ignoreCase = true) || p.propietario.contains(q, ignoreCase = true) || p.telefono.contains(q) }
        if (locales.isNotEmpty()) {
            val primero = locales.first()
            val etiqueta = "Dueño encontrado: ${primero.propietario} (${primero.email})"
            return locales.map { Encontrada(Candidata(it.id, "${it.nombre} (${it.razaYSexo})", it), etiqueta) }
        }
        if (q.length < 6) return emptyList()
        val duenos = Servicios.fuente.buscarDueno(q)
        return duenos.flatMap { dueno ->
            val etiqueta = "Dueño encontrado: ${dueno.nombre} (${dueno.email.orEmpty()})"
            dueno.mascotas.map { m ->
                val datos = m.jsonObject
                val id = datos["id"]!!.jsonPrimitive.content
                val nombre = datos["nombre"]!!.jsonPrimitive.content
                val raza = datos["raza"]?.jsonPrimitive?.content?.takeIf { it != "null" } ?: datos["tipo"]?.jsonPrimitive?.content.orEmpty()
                val propio = propios.firstOrNull { it.id == id }
                Encontrada(Candidata(id, "$nombre ($raza)" + if (propio == null) " · sin acceso" else "", propio), etiqueta)
            }
        }
    }

    /** El veterinario todavía no puede ver la mascota: se le pide acceso al dueño y se agenda cuando lo acepte. */
    private fun pedirAcceso(candidata: Candidata) {
        lifecycleScope.launch {
            try {
                val resultado = Servicios.fuente.solicitarAcceso(candidata.mascotaId)
                if (resultado == "activo") {
                    PacientesRepo.cargar()
                    Avisos.mostrar(this@AgregarConsultaActivity, "Ya tenés acceso. Volvé a buscar para agendar.")
                } else {
                    Avisos.mostrar(this@AgregarConsultaActivity, "Le pedimos acceso al dueño. Vas a poder agendar el turno cuando lo acepte.")
                    finish()
                }
            } catch (e: Exception) {
                Avisos.error(this@AgregarConsultaActivity, Errores.mensaje(e))
            }
        }
    }

    private fun registrarEnCarnet(mascotaId: String, tipo: String, motivo: String, notas: String, fecha: LocalDate) {
        val detalle = notas.ifEmpty { "Registrado por el veterinario" }
        when (tipo) {
            "Vacuna" -> SaludRepo.agregar(TipoRegistro.VACUNA, mascotaId, motivo, detalle, fecha)
            "Tratamiento" -> SaludRepo.agregar(TipoRegistro.TRATAMIENTO, mascotaId, motivo, detalle, fecha)
        }
    }
}
