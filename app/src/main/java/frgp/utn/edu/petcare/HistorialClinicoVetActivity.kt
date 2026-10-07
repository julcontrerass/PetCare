package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.PopupMenu
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout

class HistorialClinicoVetActivity : AppCompatActivity() {

    private lateinit var rvHistorial: RecyclerView
    private lateinit var adapter: HistorialVetAdapter
    private lateinit var tabLayout: TabLayout
    private lateinit var paciente: Paciente

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.historial_clinico_vista_veterinario)

        VetBottomNav.setup(this, R.id.nav_pacientes)

        paciente = PacientesRepo.porId(intent.getIntExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, -1))

        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }

        findViewById<TextView>(R.id.tvPetName).text = paciente.nombre
        findViewById<TextView>(R.id.tvPetBreed).text = paciente.razaYSexo
        findViewById<TextView>(R.id.tvPetAge).text = paciente.nacimiento
        findViewById<ImageView>(R.id.ivPetPhoto).setImageResource(paciente.fotoRes)

        findViewById<View>(R.id.btnMoreHistorial)?.setOnClickListener { v ->
            PopupMenu(this, v).apply {
                menu.add(0, 1, 0, "Agregar consulta")
                menu.add(0, 2, 1, "Compartir historial")
                setOnMenuItemClickListener {
                    when (it.itemId) {
                        1 -> abrirAgregarConsulta()
                        else -> compartirHistorial()
                    }
                    true
                }
            }.show()
        }
        findViewById<View>(R.id.fabAdd)?.setOnClickListener { abrirAgregarConsulta() }

        rvHistorial = findViewById(R.id.rvHistorial)
        tabLayout = findViewById(R.id.tabLayoutFilters)
        adapter = HistorialVetAdapter(emptyList())
        rvHistorial.adapter = adapter

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) = refrescar()
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    override fun onResume() {
        super.onResume()
        refrescar()
    }

    private fun abrirAgregarConsulta() {
        startActivity(
            Intent(this, AgregarConsultaActivity::class.java)
                .putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, paciente.id)
        )
    }

    private fun compartirHistorial() {
        val texto = buildString {
            appendLine("Historial clínico de ${paciente.nombre} (${paciente.razaYSexo})")
            AgendaRepo.deMascota(paciente.id).forEach {
                appendLine("- ${Fechas.corta(it.fecha)} · ${it.tipo}: ${it.motivo} [${it.estado.etiqueta}]")
                if (it.notas.isNotBlank()) appendLine("    ${it.notas}")
            }
        }
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).setType("text/plain")
                    .putExtra(Intent.EXTRA_SUBJECT, "Historial de ${paciente.nombre}")
                    .putExtra(Intent.EXTRA_TEXT, texto),
                "Compartir historial"
            )
        )
    }

    private fun categoriaDe(tipo: String) = when (tipo) {
        "Consulta" -> HistorialCategory.CONSULTA
        "Vacuna" -> HistorialCategory.VACUNA
        "Tratamiento" -> HistorialCategory.TRATAMIENTO
        else -> HistorialCategory.OTROS
    }

    private fun refrescar() {
        val seleccionada = when (tabLayout.selectedTabPosition) {
            1 -> HistorialCategory.CONSULTA
            2 -> HistorialCategory.VACUNA
            3 -> HistorialCategory.TRATAMIENTO
            4 -> HistorialCategory.OTROS
            else -> HistorialCategory.TODOS
        }
        val filas = mutableListOf<HistorialVetUIItem>()
        var mesActual: String? = null
        for (e in AgendaRepo.deMascota(paciente.id)) {
            val categoria = categoriaDe(e.tipo)
            if (seleccionada != HistorialCategory.TODOS && categoria != seleccionada) continue
            val mes = Fechas.mesAnio(e.fecha)
            if (mes != mesActual) {
                filas.add(HistorialVetUIItem.Header(mes))
                mesActual = mes
            }
            val estado = if (e.estado == EstadoEvento.COMPLETADO) "" else " · ${e.estado.etiqueta}"
            filas.add(
                HistorialVetUIItem.Event(
                    "%02d".format(e.fecha.dayOfMonth), Fechas.mesCorto(e.fecha), e.motivo,
                    e.veterinario + estado, e.notas, DetalleEventoVetActivity.iconoDe(e.tipo),
                    categoria, e.id
                )
            )
        }
        adapter.updateItems(filas)

        val vacio = findViewById<View>(R.id.emptyHistorialVet)
        vacio.visibility = if (filas.isEmpty()) View.VISIBLE else View.GONE
        rvHistorial.visibility = if (filas.isEmpty()) View.GONE else View.VISIBLE
        vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_document)
        vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "Sin registros"
        vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = "No hay eventos de este tipo para ${paciente.nombre}"
    }
}
