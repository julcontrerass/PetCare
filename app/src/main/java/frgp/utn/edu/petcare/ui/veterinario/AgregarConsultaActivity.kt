package frgp.utn.edu.petcare.ui.veterinario

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.DisponibilidadVet
import frgp.utn.edu.petcare.data.repositorio.EstadoEvento
import frgp.utn.edu.petcare.data.repositorio.Paciente
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.repositorio.SaludRepo
import frgp.utn.edu.petcare.data.repositorio.TipoRegistro
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.BaseActivity
import frgp.utn.edu.petcare.ui.common.VetUi
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class AgregarConsultaActivity : BaseActivity() {

    /** Mascota que aparece al buscar un dueño: [paciente] es null si todavía no fue compartida con el veterinario. */
    private class Candidata(val mascotaId: String, val etiqueta: String, val paciente: Paciente?)

    private var fecha: LocalDate? = null
    private var candidatas = listOf<Candidata>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.activity_agregar_consulta)

        VetUi.barras(this)
        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }

        val spPaciente = findViewById<Spinner>(R.id.spPaciente)
        val spTipo = findViewById<Spinner>(R.id.spTipo)
        val pacientes = PacientesRepo.pacientes

        spPaciente.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item, pacientes.map { "${it.nombre} (${it.propietario})" }
        )
        spTipo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, AgendaRepo.tipos())
        fun duracion() = PerfilVetRepo.duracionDe(spTipo.selectedItem as? String)

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

        val btnNuevoDueno = findViewById<MaterialButton>(R.id.btnToggleNuevoDueno)

        // El dueño nuevo se carga en su propia pantalla, sin tener que dar el turno: al volver queda elegida su mascota
        val altaDeDueno = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { resultado ->
            val id = resultado.data?.getStringExtra(NuevoDuenoActivity.EXTRA_PACIENTE_ID)
            if (resultado.resultCode != RESULT_OK || id == null) return@registerForActivityResult
            val actuales = PacientesRepo.pacientes
            spPaciente.adapter = ArrayAdapter(
                this, android.R.layout.simple_spinner_dropdown_item, actuales.map { "${it.nombre} (${it.propietario})" }
            )
            val i = actuales.indexOfFirst { it.id == id }
            if (i >= 0) spPaciente.setSelection(i)
            candidatas = emptyList()
            layoutDuenoEncontrado.visibility = View.GONE
            Avisos.mostrar(this, "Listo, ya podés agendar el turno")
        }

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
                        tvDuenoInfo.text = encontradas.first().etiquetaDueno
                        spMascotasDueno.adapter = ArrayAdapter(
                            this@AgregarConsultaActivity, android.R.layout.simple_spinner_dropdown_item,
                            encontradas.map { it.candidata.etiqueta }
                        )
                        Avisos.mostrar(this@AgregarConsultaActivity, "Dueño encontrado con ${encontradas.size} mascota(s)")
                    } else {
                        candidatas = emptyList()
                        layoutDuenoEncontrado.visibility = View.GONE
                        Avisos.mostrar(
                            this@AgregarConsultaActivity,
                            "No hay un dueño con ese dato. Registralo con el botón \"Registrar dueño y mascota nuevos\"."
                        )
                    }
                } catch (e: Exception) {
                    Avisos.error(this@AgregarConsultaActivity, Errores.mensaje(e))
                } finally {
                    btnBuscarDueno.isEnabled = true
                }
            }
        }

        btnNuevoDueno.setOnClickListener {
            val buscado = etBuscarDueno.text.toString().trim()
            altaDeDueno.launch(
                Intent(this, NuevoDuenoActivity::class.java).apply {
                    // Lo que se buscó sirve de punto de partida: un correo o un DNI
                    if (buscado.contains("@")) putExtra(NuevoDuenoActivity.EXTRA_CORREO, buscado)
                    else if (buscado.all { it.isDigit() } && buscado.length in 7..8) putExtra(NuevoDuenoActivity.EXTRA_DNI, buscado)
                }
            )
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
                if (hora.isNotBlank() && DisponibilidadVet.validar(elegida, hora, duracion()) != null) {
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
                SelectorHoraVet.mostrar(this, f, etHora.text.toString().ifBlank { null }, null, duracion()) { hora ->
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

            val problema = DisponibilidadVet.validar(fecha!!, etHora.text.toString(), duracion())
            if (problema != null) {
                etHora.error = problema
                Avisos.mostrar(this, problema)
                return@setOnClickListener
            }

            var pacienteElegido: Paciente? = null

            // 1. Si se buscó un dueño existente
            if (layoutDuenoEncontrado.visibility == View.VISIBLE && candidatas.isNotEmpty()) {
                val candidata = candidatas.getOrNull(spMascotasDueno.selectedItemPosition)
                if (candidata != null && candidata.paciente == null) {
                    // El turno queda pedido junto con el acceso: se agenda solo cuando el dueño acepta
                    val propuesta = buildJsonObject {
                        put("categoria", spTipo.selectedItem as String)
                        put("motivo", etMotivo.text.toString().trim())
                        put("fecha", fecha!!.toString())
                        put("hora", etHora.text.toString() + ":00")
                        put("notas", etNotas.text.toString().trim())
                    }
                    pedirAcceso(candidata, propuesta)
                    return@setOnClickListener
                }
                pacienteElegido = candidata?.paciente
            }
            // 2. Selección de la lista general
            else {
                pacienteElegido = pacientes.getOrNull(spPaciente.selectedItemPosition)
            }

            if (pacienteElegido == null) {
                Avisos.mostrar(this, "Seleccioná o registrá una mascota")
                return@setOnClickListener
            }
            if (!PerfilVetRepo.atiende(pacienteElegido.especie)) {
                avisarQueNoAtiende(pacienteElegido.especie)
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

    private fun avisarQueNoAtiende(tipo: String) {
        val animales = TiposMascota.plural(TiposMascota.normalizar(tipo)).lowercase()
        Avisos.informar(
            this, "No atendés $animales",
            "No tenés ese tipo de animal entre los que atendés, así que no podés agendar este turno. " +
                "Podés agregarlo desde tu perfil, en \"Animales que atiendo\".",
            icono = R.drawable.ic_warning
        )
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
    private fun pedirAcceso(candidata: Candidata, propuesta: JsonObject) {
        lifecycleScope.launch {
            try {
                val resultado = Servicios.fuente.solicitarAcceso(candidata.mascotaId, propuesta)
                if (resultado == "activo") {
                    PacientesRepo.cargar()
                    Avisos.mostrar(this@AgregarConsultaActivity, "Ya tenés acceso. Volvé a buscar para agendar.")
                } else {
                    val fecha = runCatching { LocalDate.parse(propuesta["fecha"]?.jsonPrimitive?.content) }.getOrNull()
                    val cuando = fecha?.let { Fechas.corta(it) + " a las " + propuesta["hora"]?.jsonPrimitive?.content?.take(5) }
                    Avisos.informar(
                        this@AgregarConsultaActivity, "Pedido enviado al dueño",
                        "Le pedimos acceso a la mascota. El turno" + (cuando?.let { " del $it hs" } ?: "") +
                            " se agenda solo apenas el dueño lo acepte, y te llega el aviso.",
                        cancelable = false
                    ) { finish() }
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
