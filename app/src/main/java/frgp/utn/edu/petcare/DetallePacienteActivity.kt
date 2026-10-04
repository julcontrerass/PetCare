package frgp.utn.edu.petcare

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.PopupMenu
import android.widget.Toast
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.tabs.TabLayout
import com.google.android.material.tabs.TabLayoutMediator

class DetallePacienteActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PACIENTE_ID = "paciente_id"

        fun pacienteDe(activity: AppCompatActivity): Paciente =
            PacientesRepo.porId(activity.intent.getIntExtra(EXTRA_PACIENTE_ID, -1))
    }

    private fun abrirExterno(intent: Intent) {
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No hay una aplicación disponible para esta acción", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.detalle_paciente)

        VetBottomNav.setup(this, R.id.nav_pacientes)

        val paciente = pacienteDe(this)
        findViewById<android.widget.TextView>(R.id.tvPetName).text = paciente.nombre
        findViewById<android.widget.TextView>(R.id.tvPetBreed).text = paciente.razaYSexo
        findViewById<android.widget.TextView>(R.id.tvPetAge).text = paciente.nacimiento
        findViewById<android.widget.ImageView>(R.id.ivPetPhoto).setImageResource(paciente.fotoRes)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(false)
        toolbar.setNavigationOnClickListener { onBackPressed() }

        findViewById<View>(R.id.btnMorePaciente)?.setOnClickListener { v ->
            PopupMenu(this, v).apply {
                menu.add(0, 1, 0, "Agregar consulta")
                menu.add(0, 2, 1, "Ver historial clínico")
                menu.add(0, 3, 2, "Llamar al propietario")
                menu.add(0, 4, 3, "Enviar correo al propietario")
                setOnMenuItemClickListener {
                    when (it.itemId) {
                        1 -> startActivity(
                            Intent(this@DetallePacienteActivity, AgregarConsultaActivity::class.java)
                                .putExtra(EXTRA_PACIENTE_ID, paciente.id)
                        )
                        2 -> startActivity(
                            Intent(this@DetallePacienteActivity, HistorialClinicoVetActivity::class.java)
                                .putExtra(EXTRA_PACIENTE_ID, paciente.id)
                        )
                        3 -> abrirExterno(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + paciente.telefono.filter { c -> c.isDigit() || c == '+' })))
                        else -> abrirExterno(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + paciente.email)))
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
                    0 -> ResumenFragment()
                    1 -> InformacionVetFragment()
                    2 -> PropietarioFragment()
                    3 -> ArchivosFragment()
                    else -> throw IllegalStateException("Invalid position $position")
                }
            }
        }

        TabLayoutMediator(tabLayout, viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Resumen"
                1 -> "Información"
                2 -> "Propietario"
                3 -> "Archivos"
                else -> null
            }
        }.attach()
    }
}