package frgp.utn.edu.petcare.ui.auth

import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.AdminRepo
import frgp.utn.edu.petcare.BaseActivity
import frgp.utn.edu.petcare.DatosRegistroDueno
import frgp.utn.edu.petcare.HomeAdminActivity
import frgp.utn.edu.petcare.HomeVeterinarioActivity
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.RegistroDuenoActivity
import frgp.utn.edu.petcare.RegistroVeterinarioActivity
import frgp.utn.edu.petcare.data.CuentasRepo
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.ui.dueno.DuenoActivity
import java.util.Locale

/**
 * Puerta de entrada de la app: bienvenida, ingreso, registro y recuperación de contraseña.
 * Según la cuenta, deriva al panel del dueño, del veterinario o del administrador.
 */
class AuthActivity : BaseActivity() {

    private var rolVeterinarioSeleccionado = false
    private var registroComoVeterinario = false

    private val registroDuenoLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { resultado ->
            val datos = resultado.data?.let {
                IntentCompat.getSerializableExtra(it, RegistroDuenoActivity.EXTRA_DATOS, DatosRegistroDueno::class.java)
            }
            if (resultado.resultCode != RESULT_OK || datos == null) return@registerForActivityResult
            CuentasRepo.registrarDueno(datos)
            cuentaCreada(datos.email)
        }

    private val registroVetLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { resultado ->
            val datos = resultado.data
            if (resultado.resultCode != RESULT_OK || datos == null) return@registerForActivityResult
            val email = datos.getStringExtra(RegistroVeterinarioActivity.EXTRA_EMAIL)
            val password = datos.getStringExtra(RegistroVeterinarioActivity.EXTRA_PASSWORD)
            if (email == null || password == null) return@registerForActivityResult
            CuentasRepo.registrarVeterinario(email, password)
            cuentaCreada(email)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        mostrarPantallaInicial()
    }

    private fun cuentaCreada(email: String) {
        Toast.makeText(this, "Cuenta creada. Iniciá sesión para continuar", Toast.LENGTH_LONG).show()
        mostrarLogin()
        findViewById<EditText>(R.id.etEmail)?.setText(email)
    }

    private fun aplicarInsets(raiz: View) {
        ViewCompat.setOnApplyWindowInsetsListener(raiz) { vista, insets ->
            val barras = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            vista.setPadding(barras.left, barras.top, barras.right, barras.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(raiz)
    }

    // ---------- Bienvenida ----------

    private fun mostrarPantallaInicial() {
        setContentView(R.layout.activity_main)
        val raiz = findViewById<View>(R.id.main)
        val panel = findViewById<View>(R.id.panelBienvenida)
        val paddingInferior = panel?.paddingBottom ?: 0
        ViewCompat.setOnApplyWindowInsetsListener(raiz) { vista, insets ->
            val barras = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            vista.setPadding(barras.left, barras.top, barras.right, 0)
            panel?.setPadding(panel.paddingLeft, panel.paddingTop, panel.paddingRight, paddingInferior + barras.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(raiz)

        findViewById<Button>(R.id.button2)?.setOnClickListener { mostrarRegistro() }
        findViewById<Button>(R.id.button).setOnClickListener { mostrarLogin() }
    }

    // ---------- Ingreso ----------

    private fun mostrarLogin() {
        setContentView(R.layout.iniciar_sesion)
        aplicarInsets(findViewById(R.id.loginRoot))

        rolVeterinarioSeleccionado = false
        val btnDueno = findViewById<MaterialButton>(R.id.btnRoleDueno)
        val btnVeterinario = findViewById<MaterialButton>(R.id.btnRoleVeterinario)
        if (btnDueno != null && btnVeterinario != null) {
            actualizarSelectorRol(btnDueno, btnVeterinario, rolVeterinarioSeleccionado)
            btnDueno.setOnClickListener {
                rolVeterinarioSeleccionado = false
                actualizarSelectorRol(btnDueno, btnVeterinario, false)
            }
            btnVeterinario.setOnClickListener {
                rolVeterinarioSeleccionado = true
                actualizarSelectorRol(btnDueno, btnVeterinario, true)
            }
        }

        findViewById<View>(R.id.tvForgotPassword)?.setOnClickListener { mostrarRecuperarPassword() }
        findViewById<View>(R.id.tvSignUp)?.setOnClickListener { mostrarRegistro() }
        findViewById<View>(R.id.btnGoogle)?.setOnClickListener { mostrarLoginSocial("Google") }
        findViewById<View>(R.id.btnApple)?.setOnClickListener { mostrarLoginSocial("Apple") }
        findViewById<Button>(R.id.btnLogin)?.setOnClickListener { intentarIngresar() }
    }

    private fun intentarIngresar() {
        val etEmail = findViewById<EditText>(R.id.etEmail)
        val etPassword = findViewById<EditText>(R.id.etPassword)
        val email = etEmail?.text?.toString()?.trim()?.lowercase(Locale.ROOT).orEmpty()
        val password = etPassword?.text?.toString().orEmpty()

        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            etEmail?.error = "Ingresá un correo válido"
            return
        }
        if (password.isEmpty()) {
            etPassword?.error = "Ingresá tu contraseña"
            return
        }
        if (password.length < 6) {
            etPassword?.error = "Mínimo 6 caracteres"
            return
        }
        if (CuentasRepo.passwordIncorrecta(email, password)) {
            etPassword?.error = "Contraseña incorrecta"
            return
        }

        // Ingreso como administrador
        if (email == AdminRepo.EMAIL_ADMIN || email.startsWith("admin@")) {
            startActivity(Intent(this, HomeAdminActivity::class.java))
            return
        }

        // Veterinarios en revisión, rechazados o suspendidos y cuentas suspendidas no pueden ingresar
        AdminRepo.motivoBloqueo(email)?.let { bloqueo ->
            AlertDialog.Builder(this)
                .setTitle("No podés ingresar")
                .setMessage(bloqueo)
                .setPositiveButton("Entendido", null)
                .show()
            return
        }

        // Si la cuenta se creó en el registro, el rol sale de ahí
        val esVeterinario = when (CuentasRepo.rolDe(email)) {
            CuentasRepo.Rol.VETERINARIO -> true
            CuentasRepo.Rol.DUENO -> false
            null -> rolVeterinarioSeleccionado
        }
        if (esVeterinario) abrirVeterinario() else abrirDueno(email)
    }

    private fun abrirVeterinario() = startActivity(Intent(this, HomeVeterinarioActivity::class.java))

    private fun abrirDueno(email: String) {
        DuenoRepo.entrar(email)
        startActivity(Intent(this, DuenoActivity::class.java))
    }

    /** Ingreso con cuenta social: sin backend, se simula la cuenta y se elige el rol. */
    private fun mostrarLoginSocial(proveedor: String) {
        AlertDialog.Builder(this)
            .setTitle("Continuar con $proveedor")
            .setMessage("Elegí cómo querés usar PetCare con esta cuenta.")
            .setPositiveButton(R.string.rol_dueno) { _, _ -> abrirDueno("") }
            .setNegativeButton(R.string.rol_veterinario) { _, _ -> abrirVeterinario() }
            .setNeutralButton(R.string.btn_cancelar, null)
            .show()
    }

    // ---------- Registro y recuperación ----------

    private fun mostrarRegistro() {
        setContentView(R.layout.registro)
        aplicarInsets(findViewById(R.id.registroRoot))

        registroComoVeterinario = false
        val btnDueno = findViewById<MaterialButton>(R.id.btnRegRoleDueno)
        val btnVet = findViewById<MaterialButton>(R.id.btnRegRoleVet)
        val avisoDueno = findViewById<View>(R.id.llAvisoDueno)
        val avisoVet = findViewById<View>(R.id.llAvisoVet)
        fun actualizarRol() {
            actualizarSelectorRol(btnDueno, btnVet, registroComoVeterinario)
            avisoDueno.visibility = if (registroComoVeterinario) View.GONE else View.VISIBLE
            avisoVet.visibility = if (registroComoVeterinario) View.VISIBLE else View.GONE
        }
        btnDueno.setOnClickListener { registroComoVeterinario = false; actualizarRol() }
        btnVet.setOnClickListener { registroComoVeterinario = true; actualizarRol() }
        actualizarRol()

        findViewById<View>(R.id.btnBackRegistro).setOnClickListener { mostrarPantallaInicial() }
        findViewById<View>(R.id.btnComenzarDueno).setOnClickListener {
            val intent = Intent(this, RegistroDuenoActivity::class.java)
                .putStringArrayListExtra(RegistroDuenoActivity.EXTRA_EMAILS_REGISTRADOS, CuentasRepo.correosRegistrados())
            registroDuenoLauncher.launch(intent)
        }
        findViewById<View>(R.id.btnComenzarVet).setOnClickListener {
            val intent = Intent(this, RegistroVeterinarioActivity::class.java)
                .putStringArrayListExtra(RegistroVeterinarioActivity.EXTRA_EMAILS_REGISTRADOS, CuentasRepo.correosRegistrados())
            registroVetLauncher.launch(intent)
        }
    }

    private fun mostrarRecuperarPassword() {
        setContentView(R.layout.recuperar_password)
        aplicarInsets(findViewById(R.id.recuperarRoot))

        findViewById<View>(R.id.btnBackRecuperar).setOnClickListener { mostrarLogin() }
        val etEmail = findViewById<EditText>(R.id.etRecuperarEmail)
        val avisoEnviado = findViewById<View>(R.id.tvRecuperarOk)
        findViewById<View>(R.id.btnEnviarRecuperar).setOnClickListener {
            val email = etEmail.text.toString().trim()
            if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                etEmail.error = "Correo inválido"
                avisoEnviado.visibility = View.GONE
                return@setOnClickListener
            }
            avisoEnviado.visibility = View.VISIBLE
        }
    }

    /** Pinta el botón del rol elegido en verde y el otro en blanco. */
    private fun actualizarSelectorRol(btnDueno: MaterialButton, btnVeterinario: MaterialButton, veterinario: Boolean) {
        val seleccionado = if (veterinario) btnVeterinario else btnDueno
        val noSeleccionado = if (veterinario) btnDueno else btnVeterinario
        seleccionado.backgroundTintList = ContextCompat.getColorStateList(this, R.color.primary_teal)
        seleccionado.setTextColor(ContextCompat.getColor(this, R.color.white))
        noSeleccionado.backgroundTintList = ContextCompat.getColorStateList(this, R.color.white)
        noSeleccionado.setTextColor(ContextCompat.getColor(this, R.color.text_gray))
    }
}
