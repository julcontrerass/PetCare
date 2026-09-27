package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView

class MisPacientesActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.mis_pacientes)

        VetBottomNav.setup(this, R.id.nav_pacientes)

        findViewById<View>(R.id.btnAgregarPaciente)?.setOnClickListener {
            VetBottomNav.mostrarEnDesarrollo(this)
        }
        findViewById<View>(R.id.fabCenter)?.setOnClickListener {
            VetBottomNav.mostrarEnDesarrollo(this)
        }

        val rvPacientes = findViewById<RecyclerView>(R.id.rvPacientes)

        val items = listOf(
            PacienteItem("Koda", "Golden Retriever - Macho", "Propietaria: Julieta Gómez", R.drawable.milo),
            PacienteItem("Mia", "Maltés - Hembra", "Propietaria: Julieta Gómez", R.drawable.luna),
            PacienteItem("Milo", "Bulldog Francés - Macho", "Propietario: Lucas Rodríguez", R.drawable.milo),
            PacienteItem("Luna", "Gato Siamés - Hembra", "Propietaria: María Fernández", R.drawable.luna),
            PacienteItem("Simba", "Gato Maine Coon - Macho", "Propietario: Carlos Pérez", R.drawable.milo)
        )

        rvPacientes.adapter = PacientesAdapter(items)
    }
}