package frgp.utn.edu.petcare.ui.veterinario

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.materialswitch.MaterialSwitch
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.ValidacionDueno
import frgp.utn.edu.petcare.data.remoto.MascotaParaCuentaDto
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.BaseActivity
import frgp.utn.edu.petcare.ui.common.Contacto
import frgp.utn.edu.petcare.ui.common.VetUi
import kotlinx.coroutines.launch

/**
 * Alta de un dueño y su mascota desde el consultorio, sin pasar por un turno. Con la cuenta creada el dueño
 * ingresa después desde su casa y ve todo lo que el veterinario completó; los datos de acceso se le mandan
 * por WhatsApp. También sirve para crearle la cuenta al dueño de pacientes que ya estaban cargados.
 */
class NuevoDuenoActivity : BaseActivity() {

    companion object {
        /** Pacientes ya cargados (sin cuenta de dueño) a los que se les crea la cuenta. */
        const val EXTRA_PACIENTE_IDS = "paciente_ids"
        const val EXTRA_DNI = "dni"
        const val EXTRA_CORREO = "correo"

        /** Resultado: id de la primera mascota que quedó cargada. */
        const val EXTRA_PACIENTE_ID = "paciente_id"
    }

    private lateinit var etNombre: EditText
    private lateinit var etDni: EditText
    private lateinit var etTelefono: EditText
    private lateinit var etCorreo: EditText
    private lateinit var etMascota: EditText
    private lateinit var etRaza: EditText
    private lateinit var spTipo: Spinner
    private lateinit var spSexo: Spinner
    private lateinit var swCuenta: MaterialSwitch
    private lateinit var btnCrear: MaterialButton

    /** Pacientes ya cargados que pasan al dueño; vacío cuando se carga una mascota nueva. */
    private var existentes = listOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.activity_nuevo_dueno)
        VetUi.barras(this)
        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }

        etNombre = findViewById(R.id.etDuenoNombre)
        etDni = findViewById(R.id.etDuenoDni)
        etTelefono = findViewById(R.id.etDuenoTelefono)
        etCorreo = findViewById(R.id.etDuenoEmail)
        etMascota = findViewById(R.id.etMascotaNombre)
        etRaza = findViewById(R.id.etMascotaRaza)
        spTipo = findViewById(R.id.spMascotaTipo)
        spSexo = findViewById(R.id.spMascotaSexo)
        swCuenta = findViewById(R.id.swCrearCuenta)
        btnCrear = findViewById(R.id.btnCrear)

        spTipo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, TiposMascota.TODOS)
        spSexo.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, listOf("Macho", "Hembra"))

        val ids = intent.getStringArrayListExtra(EXTRA_PACIENTE_IDS).orEmpty()
        val pacientes = ids.mapNotNull { PacientesRepo.porId(it) }.filter { !it.tieneCuenta }
        if (pacientes.isNotEmpty()) {
            prepararParaPacientes(pacientes.map { it.id }, pacientes.map { it.nombre })
            val primero = pacientes.first()
            fun dato(valor: String) = valor.takeIf { it.isNotBlank() && it != "Sin datos" }.orEmpty()
            etNombre.setText(dato(primero.propietario))
            etDni.setText(dato(primero.dniPropietario))
            etTelefono.setText(dato(primero.telefono))
            etCorreo.setText(dato(primero.email))
        } else {
            intent.getStringExtra(EXTRA_DNI)?.let { etDni.setText(it) }
            intent.getStringExtra(EXTRA_CORREO)?.let { etCorreo.setText(it) }
        }

        swCuenta.setOnCheckedChangeListener { _, _ -> actualizarTextos() }
        actualizarTextos()
        btnCrear.setOnClickListener { crear() }
    }

    private fun prepararParaPacientes(idsPacientes: List<String>, nombres: List<String>) {
        existentes = idsPacientes
        findViewById<TextView>(R.id.tvTitulo).text = "Crear cuenta del dueño"
        findViewById<TextView>(R.id.tvSubtitulo).text = "Para que vea la ficha desde su casa"
        findViewById<View>(R.id.bloqueMascota).visibility = View.GONE
        findViewById<View>(R.id.bloqueCuenta).visibility = View.GONE
        findViewById<TextView>(R.id.tvMascotasVinculadas).apply {
            visibility = View.VISIBLE
            text = (if (nombres.size == 1) "Va a ver la ficha de " else "Va a ver las fichas de ") +
                nombres.joinToString(", ") + ", con todo lo que ya cargaste."
        }
    }

    private val conCuenta: Boolean get() = existentes.isNotEmpty() || swCuenta.isChecked

    private fun actualizarTextos() {
        val ayuda = findViewById<TextView>(R.id.tvAyudaCuenta)
        if (swCuenta.isChecked) {
            ayuda.text = "Se le crea un usuario con una contraseña temporal y le pasás los datos por WhatsApp. " +
                "Cuando ingrese ve el historial, las vacunas y los turnos que completes."
            btnCrear.text = "Crear cuenta y mascota"
        } else {
            ayuda.text = "Solo queda cargado en tus pacientes, sin cuenta del dueño. " +
                "Podés crearle la cuenta más adelante desde la ficha del paciente."
            btnCrear.text = "Guardar paciente"
        }
        if (existentes.isNotEmpty()) btnCrear.text = "Crear cuenta del dueño"
    }

    private fun crear() {
        val nombre = etNombre.text.toString().trim()
        val dni = etDni.text.toString().trim()
        val telefono = etTelefono.text.toString().trim()
        val correo = etCorreo.text.toString().trim()

        var ok = true
        fun exigir(campo: EditText, error: String?) {
            if (error != null) {
                campo.error = error
                ok = false
            }
        }
        exigir(etNombre, ValidacionDueno.nombre(nombre))
        if (conCuenta) {
            exigir(etDni, ValidacionDueno.dni(dni))
            exigir(etTelefono, ValidacionDueno.telefono(telefono))
            exigir(etCorreo, ValidacionDueno.correo(correo))
        } else {
            if (dni.isNotEmpty()) exigir(etDni, ValidacionDueno.dni(dni))
            if (correo.isNotEmpty()) exigir(etCorreo, ValidacionDueno.correo(correo))
        }
        val tipo = spTipo.selectedItem as String
        val mascota = etMascota.text.toString().trim()
        if (existentes.isEmpty()) {
            if (mascota.isBlank()) {
                etMascota.error = "Requerido"
                ok = false
            }
            if (ok && !PerfilVetRepo.atiende(tipo)) {
                avisarQueNoAtiende(tipo)
                return
            }
        }
        if (!ok) return

        if (!conCuenta) {
            val paciente = PacientesRepo.agregarManual(
                nombre = mascota, especie = tipo, raza = etRaza.text.toString().trim(),
                sexo = spSexo.selectedItem as String, propietario = nombre, telefono = telefono,
                email = correo, dni = dni
            )
            setResult(RESULT_OK, Intent().putExtra(EXTRA_PACIENTE_ID, paciente.id))
            Avisos.mostrar(this, "Paciente guardado")
            finish()
            return
        }

        btnCrear.isEnabled = false
        lifecycleScope.launch {
            try {
                val nuevas = if (existentes.isEmpty()) {
                    listOf(
                        MascotaParaCuentaDto(
                            nombre = mascota, tipo = tipo,
                            sexo = (spSexo.selectedItem as String).lowercase(),
                            raza = etRaza.text.toString().trim().ifBlank { null }
                        )
                    )
                } else {
                    emptyList()
                }
                val cuenta = PacientesRepo.crearCuentaDueno(
                    nombre = nombre, dni = dni, telefono = telefono, email = correo,
                    nuevas = nuevas, existentes = existentes
                )
                mostrarCuenta(cuenta, nombre, telefono)
            } catch (e: Exception) {
                btnCrear.isEnabled = true
                Avisos.error(this@NuevoDuenoActivity, Errores.mensaje(e), titulo = "No se pudo crear la cuenta")
            }
        }
    }

    /** Muestra los datos de acceso una sola vez, con el atajo para mandarlos por WhatsApp. */
    private fun mostrarCuenta(cuenta: PacientesRepo.CuentaCreada, dueno: String, telefono: String) {
        val mensaje = Contacto.mensajeDeAcceso(
            dueno = dueno, mascotas = cuenta.mascotas, email = cuenta.email, password = cuenta.passwordTemporal,
            veterinario = PerfilVetRepo.nombre, clinica = PerfilVetRepo.clinica
        )
        val hoja = BottomSheetDialog(this)
        val vista = layoutInflater.inflate(R.layout.sheet_cuenta_creada, null)
        hoja.setContentView(vista)
        hoja.setCancelable(false)
        hoja.setCanceledOnTouchOutside(false)
        // La contraseña no tiene que quedar en capturas ni en la vista de aplicaciones recientes
        hoja.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

        val cuantas = cuenta.mascotas.size
        vista.findViewById<TextView>(R.id.tvCuentaResumen).text =
            "Ya puede ingresar $dueno y ver " +
                (if (cuantas == 1) "la ficha de ${cuenta.mascotas.first()}" else "las fichas de sus mascotas") +
                ". Mandale estos datos para que entre desde su casa."
        vista.findViewById<TextView>(R.id.tvCuentaCorreo).text = cuenta.email
        vista.findViewById<TextView>(R.id.tvCuentaPassword).text = cuenta.passwordTemporal

        vista.findViewById<View>(R.id.btnCuentaWhatsApp).setOnClickListener {
            val intent = Contacto.whatsApp(telefono, mensaje) ?: Contacto.compartirTexto(mensaje)
            Contacto.abrir(this, intent, "No pudimos abrir WhatsApp")
        }
        vista.findViewById<View>(R.id.btnCuentaCopiar).setOnClickListener {
            val portapapeles = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            portapapeles.setPrimaryClip(ClipData.newPlainText("Datos de acceso", mensaje))
            Avisos.mostrar(this, "Datos copiados")
        }
        vista.findViewById<View>(R.id.btnCuentaListo).setOnClickListener {
            hoja.dismiss()
            setResult(RESULT_OK, Intent().putExtra(EXTRA_PACIENTE_ID, cuenta.mascotaIds.firstOrNull()))
            finish()
        }
        hoja.show()
    }

    private fun avisarQueNoAtiende(tipo: String) {
        val animales = TiposMascota.plural(TiposMascota.normalizar(tipo)).lowercase()
        Avisos.informar(
            this, "No atendés $animales",
            "No tenés ese tipo de animal entre los que atendés. Podés agregarlo desde tu perfil, " +
                "en \"Animales que atiendo\".",
            icono = R.drawable.ic_warning
        )
    }
}
