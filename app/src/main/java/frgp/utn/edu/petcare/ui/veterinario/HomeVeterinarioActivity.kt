package frgp.utn.edu.petcare.ui.veterinario

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import com.google.android.material.bottomnavigation.BottomNavigationView
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.BaseActivity
import frgp.utn.edu.petcare.ui.common.Diseno
import frgp.utn.edu.petcare.ui.common.VetUi

/**
 * Contenedor de la app del veterinario: una barra inferior fija y, arriba, la sección que se esté viendo
 * (inicio, pacientes, agenda o perfil). Al cambiar de solapa solo se reemplaza el contenido: la barra no se toca.
 */
class HomeVeterinarioActivity : BaseActivity() {

    private lateinit var bottomNav: BottomNavigationView
    private var seccion: SeccionVet? = null

    private val selectorDeFoto = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) alElegirFoto?.invoke(uri)
    }
    private var alElegirFoto: ((Uri) -> Unit)? = null

    /** Abre la galería y devuelve la imagen elegida (la usa el perfil para cambiar la foto). */
    fun pedirFoto(alElegir: (Uri) -> Unit) {
        alElegirFoto = alElegir
        selectorDeFoto.launch("image/*")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.activity_home_veterinario)
        VetUi.barras(this)

        bottomNav = findViewById(R.id.bottomNavigation)
        findViewById<View>(R.id.fabCenter).setOnClickListener {
            startActivity(Intent(this, AgregarConsultaActivity::class.java))
        }
        bottomNav.setOnItemSelectedListener { item ->
            if (item.itemId == R.id.nav_placeholder) {
                false
            } else {
                irA(item.itemId)
                true
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (seccion?.navId != R.id.nav_inicio) {
                    irA(R.id.nav_inicio)
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        irA(intent.getIntExtra(EXTRA_SECCION, R.id.nav_inicio))
        pedirPermisoDeNotificaciones()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        irA(intent.getIntExtra(EXTRA_SECCION, R.id.nav_inicio))
    }

    override fun onResume() {
        super.onResume()
        if (isFinishing) return
        seccion?.refrescar()
        // La sección visible se vuelve a dibujar cuando llegan datos nuevos
        actualizarDatosVeterinario { seccion?.refrescar() }
    }

    /** Muestra la sección de la solapa [navId]; la barra inferior queda como está y solo cambia el contenido. */
    fun irA(navId: Int) {
        if (seccion?.navId == navId) return
        val nueva = when (navId) {
            R.id.nav_pacientes -> PacientesVetSeccion(this)
            R.id.nav_agenda -> AgendaVetSeccion(this)
            R.id.nav_mas -> PerfilVetSeccion(this)
            else -> InicioVetSeccion(this)
        }
        val contenedor = findViewById<ViewGroup>(R.id.contenidoVet)
        contenedor.removeAllViews()
        layoutInflater.inflate(nueva.layout, contenedor, true)
        bottomNav.menu.findItem(nueva.navId)?.isChecked = true
        nueva.configurar()
        seccion = nueva
        nueva.refrescar()
        Diseno.forzar(contenedor)
    }

    companion object {
        /** Solapa a mostrar al abrir (una de las `R.id.nav_*` de la barra); por defecto, el inicio. */
        const val EXTRA_SECCION = "seccion"
    }
}
