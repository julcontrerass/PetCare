package frgp.utn.edu.petcare

import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.util.Patterns
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton

class PerfilVetActivity : BaseActivity() {

    companion object {
        private const val PREFS = "petcare_prefs"
        private val claves = listOf("notif_solicitudes", "notif_turnos", "notif_cancelaciones")
        private val etiquetas = arrayOf(
            "Nuevas solicitudes de acceso", "Recordatorios de turnos", "Cancelaciones de turnos"
        )
    }

    private val pickPhotoLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            PerfilVetRepo.fotoUriString = it.toString()
            mostrarPerfil()
            Toast.makeText(this, "Foto de perfil actualizada correctamente", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.perfil_vet)

        VetBottomNav.setup(this, R.id.nav_mas)

        findViewById<View>(R.id.btnEditVetProfilePic)?.setOnClickListener {
            pickPhotoLauncher.launch("image/*")
        }
        findViewById<View>(R.id.ivVetProfilePic)?.setOnClickListener {
            pickPhotoLauncher.launch("image/*")
        }

        findViewById<View>(R.id.llVetHorarios)?.setOnClickListener { configurarHorarios() }
        findViewById<View>(R.id.llVetEspecialidades)?.setOnClickListener { configurarEspecialidades() }

        findViewById<View>(R.id.optEditarPerfil)?.setOnClickListener { editarPerfil() }
        findViewById<View>(R.id.optCambiarPassword)?.setOnClickListener { cambiarPassword() }
        findViewById<View>(R.id.optNotificaciones)?.setOnClickListener { configurarNotificaciones() }
        findViewById<View>(R.id.optCerrarSesion)?.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Cerrar sesión")
                .setMessage("¿Querés cerrar tu sesión?")
                .setPositiveButton("Cerrar sesión") { _, _ ->
                    val intent = Intent(this, MainActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    startActivity(intent)
                }
                .setNegativeButton("Cancelar", null)
                .show()
        }
        mostrarPerfil()
    }

    private fun mostrarPerfil() {
        findViewById<TextView>(R.id.tvNombreVet)?.text = PerfilVetRepo.nombre
        findViewById<TextView>(R.id.tvDatosVet)?.text = "Matrícula ${PerfilVetRepo.matricula}"
        findViewById<TextView>(R.id.tvVetDniValue)?.text = PerfilVetRepo.dni
        findViewById<TextView>(R.id.tvVetClinicaValue)?.text = PerfilVetRepo.clinica
        findViewById<TextView>(R.id.tvVetDireccionValue)?.text = PerfilVetRepo.direccionClinica
        findViewById<TextView>(R.id.tvVetPhoneValue)?.text = PerfilVetRepo.telefono
        findViewById<TextView>(R.id.tvVetEmailValue)?.text = PerfilVetRepo.email
        findViewById<TextView>(R.id.tvVetHorariosValue)?.text = PerfilVetRepo.textoHorarios()
        findViewById<TextView>(R.id.tvVetEspecialidadesValue)?.text = PerfilVetRepo.textoEspecialidades()

        VetUi.cargarFotoVet(findViewById<ImageView>(R.id.ivVetProfilePic))
    }

    private fun campo(hint: String, valor: String = "", tipo: Int = InputType.TYPE_CLASS_TEXT) = EditText(this).apply {
        this.hint = hint
        setText(valor)
        inputType = tipo
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(0, 12, 0, 12) }
    }

    private fun formulario(titulo: String, campos: List<EditText>, alGuardar: () -> Boolean) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 8)
            campos.forEach { addView(it) }
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle(titulo)
            .setView(ScrollView(this).apply { addView(layout) })
            .setPositiveButton("Guardar", null)
            .setNegativeButton("Cancelar", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                if (alGuardar()) dialog.dismiss()
            }
        }
        dialog.show()
    }

    private fun seleccionarHora(horaInicial: String, alSeleccionar: (String) -> Unit) {
        val partes = horaInicial.replace(" hs", "").split(":")
        val h = partes.getOrNull(0)?.toIntOrNull() ?: 9
        val m = partes.getOrNull(1)?.toIntOrNull() ?: 0

        TimePickerDialog(this, { _, hourOfDay, minute ->
            val horaFormateada = String.format("%02d:%02d", hourOfDay, minute)
            alSeleccionar(horaFormateada)
        }, h, m, true).show()
    }

    private fun configurarHorarios() {
        val marcadas = PerfilVetRepo.diasSeleccionados.clone()
        var tempInicio = PerfilVetRepo.horaApertura
        var tempFin = PerfilVetRepo.horaCierre

        val btnInicio = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = "Hora de inicio: $tempInicio hs"
            setOnClickListener {
                seleccionarHora(tempInicio) { elegida ->
                    tempInicio = elegida
                    text = "Hora de inicio: $tempInicio hs"
                }
            }
        }

        val btnFin = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = "Hora de cierre: $tempFin hs"
            setOnClickListener {
                seleccionarHora(tempFin) { elegida ->
                    tempFin = elegida
                    text = "Hora de cierre: $tempFin hs"
                }
            }
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 20, 48, 10)
            addView(TextView(this@PerfilVetActivity).apply {
                text = "Seleccioná el horario de atención:"
                setTextColor(resources.getColor(R.color.black, null))
                setPadding(0, 0, 0, 12)
            })
            addView(btnInicio)
            addView(btnFin)
        }

        AlertDialog.Builder(this)
            .setTitle("Días y Horarios de atención")
            .setView(container)
            .setMultiChoiceItems(PerfilVetRepo.todosLosDias, marcadas) { _, which, checked ->
                marcadas[which] = checked
            }
            .setPositiveButton("Guardar") { _, _ ->
                System.arraycopy(marcadas, 0, PerfilVetRepo.diasSeleccionados, 0, marcadas.size)
                PerfilVetRepo.horaApertura = tempInicio
                PerfilVetRepo.horaCierre = tempFin
                mostrarPerfil()
                Toast.makeText(this, "Días y horarios actualizados", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun configurarEspecialidades() {
        val marcadas = PerfilVetRepo.especialidadesSeleccionadas.clone()
        AlertDialog.Builder(this)
            .setTitle("Especialidades y prácticas que realizás")
            .setMultiChoiceItems(PerfilVetRepo.todasLasEspecialidades, marcadas) { _, which, checked ->
                marcadas[which] = checked
            }
            .setPositiveButton("Guardar") { _, _ ->
                System.arraycopy(marcadas, 0, PerfilVetRepo.especialidadesSeleccionadas, 0, marcadas.size)
                mostrarPerfil()
                Toast.makeText(this, "Especialidades actualizadas", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun editarPerfil() {
        val nombre = campo("Nombre y Apellido", PerfilVetRepo.nombre)
        val matricula = campo("Matrícula", PerfilVetRepo.matricula)
        val clinica = campo("Clínica / Veterinaria", PerfilVetRepo.clinica)
        val direccion = campo("Dirección de la Clínica", PerfilVetRepo.direccionClinica)
        val telefono = campo("Teléfono de Contacto", PerfilVetRepo.telefono, InputType.TYPE_CLASS_PHONE)
        val email = campo("Correo Electrónico", PerfilVetRepo.email, InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)

        formulario("Editar perfil profesional", listOf(nombre, matricula, clinica, direccion, telefono, email)) {
            var ok = true
            if (nombre.text.isBlank()) { nombre.error = "Requerido"; ok = false }
            if (matricula.text.isBlank()) { matricula.error = "Requerido"; ok = false }
            if (!Patterns.EMAIL_ADDRESS.matcher(email.text.toString().trim()).matches()) {
                email.error = "Correo inválido"; ok = false
            }
            if (ok) {
                PerfilVetRepo.nombre = nombre.text.toString().trim()
                PerfilVetRepo.matricula = matricula.text.toString().trim()
                PerfilVetRepo.clinica = clinica.text.toString().trim()
                PerfilVetRepo.direccionClinica = direccion.text.toString().trim()
                PerfilVetRepo.telefono = telefono.text.toString().trim()
                PerfilVetRepo.email = email.text.toString().trim()
                mostrarPerfil()
                Toast.makeText(this, "Perfil profesional actualizado", Toast.LENGTH_SHORT).show()
            }
            ok
        }
    }

    private fun cambiarPassword() {
        val pass = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        val actual = campo("Contraseña actual", tipo = pass)
        val nueva = campo("Nueva contraseña", tipo = pass)
        val confirmar = campo("Confirmar nueva contraseña", tipo = pass)
        formulario("Cambiar contraseña", listOf(actual, nueva, confirmar)) {
            val error = PerfilVetRepo.cambiarPassword(
                actual.text.toString(), nueva.text.toString(), confirmar.text.toString()
            )
            if (error != null) {
                Toast.makeText(this, error, Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Contraseña actualizada", Toast.LENGTH_SHORT).show()
            }
            error == null
        }
    }

    private fun configurarNotificaciones() {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val marcadas = BooleanArray(claves.size) { prefs.getBoolean(claves[it], true) }
        AlertDialog.Builder(this)
            .setTitle("Notificaciones")
            .setMultiChoiceItems(etiquetas, marcadas) { _, which, checked -> marcadas[which] = checked }
            .setPositiveButton("Guardar") { _, _ ->
                val editor = prefs.edit()
                claves.forEachIndexed { i, clave -> editor.putBoolean(clave, marcadas[i]) }
                editor.apply()
                Toast.makeText(this, "Preferencias guardadas", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
