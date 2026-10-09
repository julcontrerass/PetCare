package frgp.utn.edu.petcare

import android.content.Intent
import frgp.utn.edu.petcare.ui.common.Avisos
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.text.InputType
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout

class MisPacientesActivity : BaseActivity() {

    private lateinit var adapter: PacientesAdapter
    private lateinit var etBuscar: EditText
    private lateinit var tabLayout: TabLayout

    private val especiesPorTab = listOf(
        null,
        PacientesRepo.ESPECIE_PERRO,
        PacientesRepo.ESPECIE_GATO,
        PacientesRepo.ESPECIE_OTRO
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.mis_pacientes)

        VetBottomNav.setup(this, R.id.nav_pacientes)

        findViewById<View>(R.id.toolbar)?.setOnClickListener {
            val intent = Intent(this, HomeVeterinarioActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            startActivity(intent)
            finish()
        }

        findViewById<View>(R.id.btnAgregarPaciente)?.setOnClickListener { mostrarAlta() }

        etBuscar = findViewById(R.id.etBuscarPaciente)
        tabLayout = findViewById(R.id.tabLayoutFilters)

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
        val nombres = listOf("Todos", "Perros", "Gatos", "Otros")
        for (i in nombres.indices) {
            tabLayout.getTabAt(i)?.text = "${nombres[i]} (${PacientesRepo.filtrar("", especiesPorTab[i]).size})"
        }
    }

    private fun mostrarAlta() {
        fun campo(hint: String) = EditText(this).apply {
            this.hint = hint
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 12, 0, 12) }
        }
        val nombre = campo("Nombre de la mascota")
        val raza = campo("Raza")
        val propietario = campo("Nombre del propietario")
        val telefono = campo("Teléfono del propietario").apply { inputType = InputType.TYPE_CLASS_PHONE }
        val spEspecie = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MisPacientesActivity, android.R.layout.simple_spinner_dropdown_item,
                listOf(PacientesRepo.ESPECIE_PERRO, PacientesRepo.ESPECIE_GATO, PacientesRepo.ESPECIE_OTRO)
            )
        }
        val spSexo = Spinner(this).apply {
            adapter = ArrayAdapter(this@MisPacientesActivity, android.R.layout.simple_spinner_dropdown_item, listOf("Macho", "Hembra"))
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 8)
            listOf(nombre, spEspecie, raza, spSexo, propietario, telefono).forEach { addView(it) }
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle("Agregar paciente")
            .setView(android.widget.ScrollView(this).apply { addView(layout) })
            .setPositiveButton("Guardar", null)
            .setNegativeButton("Cancelar", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                var ok = true
                if (nombre.text.isBlank()) { nombre.error = "Requerido"; ok = false }
                if (propietario.text.isBlank()) { propietario.error = "Requerido"; ok = false }
                if (!ok) return@setOnClickListener
                PacientesRepo.agregarManual(
                    nombre.text.toString().trim(), spEspecie.selectedItem as String,
                    raza.text.toString().trim(), spSexo.selectedItem as String,
                    propietario.text.toString().trim(), telefono.text.toString().trim()
                )
                actualizarContadores()
                aplicarFiltros()
                Avisos.mostrar(this, "Paciente agregado")
                dialog.dismiss()
            }
        }
        dialog.show()
    }
}
