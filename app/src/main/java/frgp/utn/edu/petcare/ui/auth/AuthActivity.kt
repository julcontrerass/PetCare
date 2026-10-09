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
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.BaseActivity
import frgp.utn.edu.petcare.HomeAdminActivity
import frgp.utn.edu.petcare.HomeVeterinarioActivity
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.RegistroDuenoActivity
import frgp.utn.edu.petcare.RegistroVeterinarioActivity
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.ui.dueno.DuenoActivity
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Puerta de entrada de la app: bienvenida, ingreso, registro y recuperación de contraseña.
 * Según la cuenta, deriva al panel del dueño, del veterinario o del administrador.
 */
class AuthActivity : BaseActivity() {

    private var registroComoVeterinario = false

    private val registroDuenoLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { resultado ->
            val datos = resultado.data
            if (resultado.resultCode != RESULT_OK || datos == null) return@registerForActivityResult
            cuentaCreada(
                datos.getStringExtra(RegistroDuenoActivity.EXTRA_EMAIL).orEmpty(),
                datos.getBooleanExtra(RegistroDuenoActivity.EXTRA_CONFIRMAR_CORREO, false),
                esVeterinario = false
            )
        }

    private val registroVetLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { resultado ->
            val datos = resultado.data
            if (resultado.resultCode != RESULT_OK || datos == null) return@registerForActivityResult
            cuentaCreada(
                datos.getStringExtra(RegistroVeterinarioActivity.EXTRA_EMAIL).orEmpty(),
                datos.getBooleanExtra(RegistroVeterinarioActivity.EXTRA_CONFIRMAR_CORREO, false),
                esVeterinario = true
            )
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        mostrarPantallaInicial()
        retomarSesion()
    }

    /** Si el teléfono todavía tiene una sesión abierta, entra directo al panel que corresponde. */
    private fun retomarSesion() {
        lifecycleScope.launch {
            Sesion.restaurar()?.let { atender(it) }
        }
    }

    /** Lleva al panel de la cuenta o, si no puede ingresar, explica por qué. */
    private fun atender(resultado: Sesion.Resultado) {
        when (resultado) {
            is Sesion.Resultado.Listo -> {
                val destino = when (resultado.rol) {
                    Sesion.Rol.DUENO -> DuenoActivity::class.java
                    Sesion.Rol.VETERINARIO -> HomeVeterinarioActivity::class.java
                    Sesion.Rol.ADMIN -> HomeAdminActivity::class.java
                }
                startActivity(Intent(this, destino))
                finish()
            }
            is Sesion.Resultado.Bloqueada -> AlertDialog.Builder(this)
                .setTitle("No podés ingresar")
                .setMessage(resultado.mensaje)
                .setPositiveButton("Entendido", null)
                .show()
        }
    }

    private fun cuentaCreada(email: String, confirmarCorreo: Boolean, esVeterinario: Boolean) {
        if (confirmarCorreo) {
            mostrarLogin()
            findViewById<EditText>(R.id.etEmail)?.setText(email)
            AlertDialog.Builder(this)
                .setTitle("Confirmá tu correo")
                .setMessage("Te mandamos un mensaje a $email. Abrilo para activar la cuenta y después iniciá sesión.")
                .setPositiveButton("Entendido", null)
                .show()
            return
        }
        lifecycleScope.launch {
            if (esVeterinario) {
                // La cuenta queda en revisión hasta que el administrador verifique la matrícula
                Sesion.cerrar()
                mostrarLogin()
                findViewById<EditText>(R.id.etEmail)?.setText(email)
            } else {
                val resultado = runCatching { Sesion.restaurar() }.getOrNull()
                if (resultado != null) {
                    atender(resultado)
                } else {
                    mostrarLogin()
                    findViewById<EditText>(R.id.etEmail)?.setText(email)
                }
            }
        }
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

        findViewById<View>(R.id.tvForgotPassword)?.setOnClickListener { mostrarRecuperarPassword() }
        findViewById<View>(R.id.tvSignUp)?.setOnClickListener { mostrarRegistro() }
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

        val boton = findViewById<Button>(R.id.btnLogin)
        boton.isEnabled = false
        lifecycleScope.launch {
            try {
                atender(Sesion.ingresar(email, password))
            } catch (e: Exception) {
                Toast.makeText(this@AuthActivity, Errores.mensaje(e), Toast.LENGTH_LONG).show()
            } finally {
                boton.isEnabled = true
            }
        }
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
            registroDuenoLauncher.launch(Intent(this, RegistroDuenoActivity::class.java))
        }
        findViewById<View>(R.id.btnComenzarVet).setOnClickListener {
            registroVetLauncher.launch(Intent(this, RegistroVeterinarioActivity::class.java))
        }
    }

    private fun mostrarRecuperarPassword() {
        setContentView(R.layout.recuperar_password)
        aplicarInsets(findViewById(R.id.recuperarRoot))

        findViewById<View>(R.id.btnBackRecuperar).setOnClickListener { mostrarLogin() }
        val etEmail = findViewById<EditText>(R.id.etRecuperarEmail)
        val avisoEnviado = findViewById<View>(R.id.tvRecuperarOk)
        val boton = findViewById<View>(R.id.btnEnviarRecuperar)
        boton.setOnClickListener {
            val email = etEmail.text.toString().trim()
            if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                etEmail.error = "Correo inválido"
                avisoEnviado.visibility = View.GONE
                return@setOnClickListener
            }
            boton.isEnabled = false
            lifecycleScope.launch {
                try {
                    Servicios.fuente.recuperarPassword(email)
                    avisoEnviado.visibility = View.VISIBLE
                } catch (e: Exception) {
                    avisoEnviado.visibility = View.GONE
                    Toast.makeText(this@AuthActivity, Errores.mensaje(e), Toast.LENGTH_LONG).show()
                } finally {
                    boton.isEnabled = true
                }
            }
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
