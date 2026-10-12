package frgp.utn.edu.petcare.ui.veterinario

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.BaseActivity

class MisPacientesActivity : BaseActivity() {

    private lateinit var adapter: PacientesAdapter
    private lateinit var etBuscar: EditText
    private lateinit var tabLayout: TabLayout

    /** Una solapa por tipo de animal, además de "Todos". */
    private val especiesPorTab = listOf<String?>(null) + TiposMascota.TODOS

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.activity_mis_pacientes)

        VetBottomNav.setup(this, R.id.nav_pacientes)

        findViewById<View>(R.id.toolbar)?.setOnClickListener {
            val intent = Intent(this, HomeVeterinarioActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            startActivity(intent)
            finish()
        }

        findViewById<View>(R.id.btnAgregarPaciente)?.setOnClickListener {
            startActivity(Intent(this, NuevoDuenoActivity::class.java))
        }

        etBuscar = findViewById(R.id.etBuscarPaciente)
        tabLayout = findViewById(R.id.tabLayoutFilters)
        especiesPorTab.forEach { _ -> tabLayout.addTab(tabLayout.newTab()) }

        adapter = PacientesAdapter(PacientesRepo.pacientes)
        findViewById<RecyclerView>(R.id.rvPacientes).adapter = adapter

        actualizarContadores()

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) = aplicarFiltros()
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
        etBuscar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = aplicarFiltros()
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun aplicarFiltros() {
        val especie = especiesPorTab[tabLayout.selectedTabPosition.coerceAtLeast(0)]
        val lista = PacientesRepo.filtrar(etBuscar.text.toString(), especie)
        adapter.updateItems(lista)

        val vacio = findViewById<View>(R.id.emptyPacientes)
        vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
        findViewById<RecyclerView>(R.id.rvPacientes).visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        vacio.findViewById<android.widget.ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_dog)
        vacio.findViewById<android.widget.TextView>(R.id.tvEmptyTitle).text = "No encontramos pacientes"
        vacio.findViewById<android.widget.TextView>(R.id.tvEmptyMessage).text = "Probá con otra búsqueda o agregá uno nuevo"
    }

    override fun onResume() {
        super.onResume()
        if (isFinishing) return
        val redibujar = {
            if (::adapter.isInitialized) {
                actualizarContadores()
                aplicarFiltros()
            }
        }
        redibujar()
        actualizarDatosVeterinario(redibujar)
    }

    private fun actualizarContadores() {
        val total = PacientesRepo.pacientes.size
        findViewById<android.widget.TextView>(R.id.tvPacientesCount).text =
            if (total == 1) "1 paciente" else "$total pacientes"
        val nombres = listOf("Todos") + TiposMascota.TODOS.map { TiposMascota.plural(it) }
        for (i in nombres.indices) {
            tabLayout.getTabAt(i)?.text = "${nombres[i]} (${PacientesRepo.filtrar("", especiesPorTab[i]).size})"
        }
    }
}
