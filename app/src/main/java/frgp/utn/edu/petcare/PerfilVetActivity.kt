package frgp.utn.edu.petcare

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class PerfilVetActivity : AppCompatActivity() {

    companion object {
        private const val PREFS = "petcare_prefs"
        private val claves = listOf("notif_solicitudes", "notif_turnos", "notif_cancelaciones")
        private val etiquetas = arrayOf(
            "Nuevas solicitudes de acceso", "Recordatorios de turnos", "Cancelaciones de turnos"
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.perfil_vet)

        VetBottomNav.setup(this, R.id.nav_mas)

        findViewById<View>(R.id.optEditarPerfil).setOnClickListener { editarPerfil() }
        findViewById<View>(R.id.optCambiarPassword).setOnClickListener { cambiarPassword() }
        findViewById<View>(R.id.optNotificaciones).setOnClickListener { configurarNotificaciones() }
        findViewById<View>(R.id.optSolicitudes).setOnClickListener {
            startActivity(Intent(this, SolicitudesVetActivity::class.java))
        }
        findViewById<View>(R.id.optCerrarSesion).setOnClickListener {
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
        findViewById<TextView>(R.id.tvNombreVet).text = PerfilVetRepo.nombre
        findViewById<TextView>(R.id.tvDatosVet).text =
            "Matrícula ${PerfilVetRepo.matricula} · ${PerfilVetRepo.clinica}\n${PerfilVetRepo.telefono} · ${PerfilVetRepo.email}"
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
            .setView(android.widget.ScrollView(this).apply { addView(layout) })
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

    private fun editarPerfil() {
        val nombre = campo("Nombre", PerfilVetRepo.nombre)
        val matricula = campo("Matrícula", PerfilVetRepo.matricula)
        val clinica = campo("Clínica", PerfilVetRepo.clinica)
        val telefono = campo("Teléfono", PerfilVetRepo.telefono, InputType.TYPE_CLASS_PHONE)
        val email = campo("Correo electrónico", PerfilVetRepo.email, InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        formulario("Editar perfil", listOf(nombre, matricula, clinica, telefono, email)) {
            var ok = true
            if (nombre.text.isBlank()) { nombre.error = "Requerido"; ok = false }
            if (matricula.text.isBlank()) { matricula.error = "Requerido"; ok = false }
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email.text.toString().trim()).matches()) {
                email.error = "Correo inválido"; ok = false
            }
            if (ok) {
                PerfilVetRepo.nombre = nombre.text.toString().trim()
                PerfilVetRepo.matricula = matricula.text.toString().trim()
                PerfilVetRepo.clinica = clinica.text.toString().trim()
                PerfilVetRepo.telefono = telefono.text.toString().trim()
                PerfilVetRepo.email = email.text.toString().trim()
                mostrarPerfil()
                Toast.makeText(this, "Perfil actualizado", Toast.LENGTH_SHORT).show()
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
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
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
