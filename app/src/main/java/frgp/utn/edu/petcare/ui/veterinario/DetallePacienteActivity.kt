package frgp.utn.edu.petcare.ui.veterinario

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.PopupMenu
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.tabs.TabLayout
import com.google.android.material.tabs.TabLayoutMediator
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.repositorio.Paciente
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.repositorio.SaludRepo
import frgp.utn.edu.petcare.data.repositorio.TipoRegistro
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.BaseActivity
import frgp.utn.edu.petcare.ui.common.Contacto
import frgp.utn.edu.petcare.ui.common.Documentos
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DetallePacienteActivity : BaseActivity() {

    companion object {
        const val EXTRA_PACIENTE_ID = "paciente_id"

        /** El paciente de la pantalla; solo se llama después de comprobar que existe. */
        fun pacienteDe(activity: AppCompatActivity): Paciente =
            PacientesRepo.porId(activity.intent.getStringExtra(EXTRA_PACIENTE_ID))
                ?: error("El paciente ya no está disponible")
    }

    private fun abrirExterno(intent: Intent) {
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            Avisos.mostrar(this, "No hay una aplicación disponible para esta acción")
        }
    }

    /** Arma el certificado con la matrícula del veterinario y abre el selector para compartirlo. */
    private fun generarCertificado(paciente: Paciente, vacunacion: Boolean) {
        if (PerfilVetRepo.matricula.isBlank()) {
            Avisos.mostrar(this, "Cargá tu matrícula en el perfil para emitir certificados")
            return
        }
        lifecycleScope.launch {
            val archivo = withContext(Dispatchers.IO) {
                if (vacunacion) {
                    val vacunas = SaludRepo.registros.filter {
                        it.mascotaId == paciente.id && it.tipo == TipoRegistro.VACUNA
                    }
                    Documentos.certificadoVacunacion(
                        this@DetallePacienteActivity, PerfilVetRepo.comoProfesional(), paciente.comoDocumento(),
                        LocalDate.now(), vacunas
                    )
                } else {
                    Documentos.certificadoSalud(
                        this@DetallePacienteActivity, PerfilVetRepo.comoProfesional(), paciente.comoDocumento(),
                        LocalDate.now()
                    )
                }
            }
            Documentos.compartir(
                this@DetallePacienteActivity, archivo,
                (if (vacunacion) "Certificado de vacunación de " else "Certificado de salud de ") + paciente.nombre
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.activity_detalle_paciente)

        VetBottomNav.setup(this, R.id.nav_pacientes)

        val paciente = PacientesRepo.porId(intent.getStringExtra(EXTRA_PACIENTE_ID))
        if (paciente == null) {
            Avisos.mostrar(this, "No se encontró la mascota")
            finish()
            return
        }
        findViewById<android.widget.TextView>(R.id.tvPetName).text = paciente.nombre
        findViewById<TextView>(R.id.tvPetBreed).text = paciente.razaYSexo
        findViewById<TextView>(R.id.tvPetAge).text = paciente.nacimiento
        findViewById<TextView>(R.id.tvPetOwner).text = "Propietario: ${paciente.propietario}"
        findViewById<TextView>(R.id.tvPetOwnerContact).text = "Contacto: ${paciente.telefono}"
        findViewById<android.widget.ImageView>(R.id.ivPetPhoto).let {
            it.setImageResource(TiposMascota.icono(paciente.especie))
            Imagenes.mostrar(it, null, paciente.fotoPath)
        }

        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }

        findViewById<View>(R.id.btnMorePaciente)?.setOnClickListener { v ->
            // La ficha puede haber cambiado desde que se abrió (por ejemplo, al crearle la cuenta al dueño)
            val actual = PacientesRepo.porId(paciente.id) ?: paciente
            PopupMenu(this, v).apply {
                menu.add(0, 1, 0, "Llamar al propietario")
                menu.add(0, 2, 1, "Enviar correo al propietario")
                menu.add(0, 3, 2, "Escribir por WhatsApp")
                menu.add(0, 4, 3, "Certificado de vacunación (PDF)")
                menu.add(0, 5, 4, "Certificado de salud (PDF)")
                // Sin cuenta, el dueño no ve nada de lo que se completa acá: se la puede crear el veterinario
                if (!actual.tieneCuenta) menu.add(0, 6, 5, "Crear cuenta del dueño")
                setOnMenuItemClickListener {
                    when (it.itemId) {
                        1 -> abrirExterno(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + paciente.telefono.filter { c -> c.isDigit() || c == '+' })))
                        2 -> abrirExterno(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + paciente.email)))
                        3 -> {
                            val dueno = paciente.propietario.takeIf { n -> n != "Sin datos" }?.substringBefore(' ')
                            val mensaje = (if (dueno != null) "Hola $dueno, " else "Hola, ") +
                                "te escribo por ${paciente.nombre}."
                            Contacto.abrir(
                                this@DetallePacienteActivity, Contacto.whatsApp(paciente.telefono, mensaje),
                                "No hay un teléfono válido para este dueño"
                            )
                        }
                        4 -> generarCertificado(paciente, vacunacion = true)
                        6 -> {
                            // También pasan al dueño los otros pacientes del mismo propietario que no tienen cuenta
                            val ids = PacientesRepo.mismoPropietarioSinCuenta(actual).map { p -> p.id }
                                .ifEmpty { listOf(paciente.id) }
                            startActivity(
                                Intent(this@DetallePacienteActivity, NuevoDuenoActivity::class.java)
                                    .putStringArrayListExtra(NuevoDuenoActivity.EXTRA_PACIENTE_IDS, ArrayList(ids))
                            )
                        }
                        else -> generarCertificado(paciente, vacunacion = false)
                    }
                    true
                }
            }.show()
        }

        val tabLayout = findViewById<TabLayout>(R.id.tabLayout)
        val viewPager = findViewById<ViewPager2>(R.id.viewPager)

        viewPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount(): Int = 4
            override fun createFragment(position: Int): Fragment {
                return when (position) {
                    0 -> InformeFragment()
                    1 -> InformacionVetFragment()
                    2 -> HistorialPacienteFragment()
                    3 -> ArchivosFragment()
                    else -> throw IllegalStateException("Invalid position $position")
                }
            }
        }

        TabLayoutMediator(tabLayout, viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Informe"
                1 -> "Información"
                2 -> "Historial clínico"
                3 -> "Archivos"
                else -> null
            }
        }.attach()
    }
}