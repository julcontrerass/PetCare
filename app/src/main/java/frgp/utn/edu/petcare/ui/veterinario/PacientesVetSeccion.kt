package frgp.utn.edu.petcare.ui.veterinario

import android.content.Intent
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.model.TiposMascota

/** Lista de pacientes del veterinario, con búsqueda y una solapa por tipo de animal. */
class PacientesVetSeccion(host: HomeVeterinarioActivity) : SeccionVet(host) {

    override val layout = R.layout.seccion_vet_pacientes
    override val navId = R.id.nav_pacientes

    private lateinit var adapter: PacientesAdapter
    private lateinit var etBuscar: EditText
    private lateinit var tabLayout: TabLayout

    /** Una solapa por tipo de animal, además de "Todos". */
    private val especiesPorTab = listOf<String?>(null) + TiposMascota.TODOS

    override fun configurar() {
        findViewById<View>(R.id.toolbar).setOnClickListener { host.irA(R.id.nav_inicio) }

        findViewById<View>(R.id.btnAgregarPaciente).setOnClickListener {
            host.startActivity(Intent(host, NuevoDuenoActivity::class.java))
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

    override fun refrescar() {
        if (!::adapter.isInitialized) return
        actualizarContadores()
        aplicarFiltros()
    }

    private fun aplicarFiltros() {
        val especie = especiesPorTab[tabLayout.selectedTabPosition.coerceAtLeast(0)]
        val lista = PacientesRepo.filtrar(etBuscar.text.toString(), especie)
        adapter.updateItems(lista)

        val vacio = findViewById<View>(R.id.emptyPacientes)
        vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
        findViewById<RecyclerView>(R.id.rvPacientes).visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_dog)
        vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "No encontramos pacientes"
        vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = "Probá con otra búsqueda o agregá uno nuevo"
    }

    private fun actualizarContadores() {
        val total = PacientesRepo.pacientes.size
        findViewById<TextView>(R.id.tvPacientesCount).text =
            if (total == 1) "1 paciente" else "$total pacientes"
        val nombres = listOf("Todos") + TiposMascota.TODOS.map { TiposMascota.plural(it) }
        for (i in nombres.indices) {
            tabLayout.getTabAt(i)?.text = "${nombres[i]} (${PacientesRepo.filtrar("", especiesPorTab[i]).size})"
        }
    }
}
