package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView

class HomeVeterinarioActivity : AppCompatActivity() {

    private lateinit var adapter: HomeVetAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.home_veterinario)

        VetBottomNav.setup(this, R.id.nav_inicio)

        findViewById<View>(R.id.ivNotifications)?.setOnClickListener {
            startActivity(Intent(this, SolicitudesVetActivity::class.java))
        }
        findViewById<View>(R.id.tvVerAgenda)?.setOnClickListener {
            startActivity(Intent(this, AgendaVetActivity::class.java))
        }
        findViewById<View>(R.id.cvVetProfile)?.setOnClickListener {
            startActivity(Intent(this, PerfilVetActivity::class.java))
        }

        adapter = HomeVetAdapter(emptyList()) { item ->
            if (item.type == ItemType.CONSULTA && item.eventoId != null) {
                startActivity(
                    Intent(this, DetalleEventoVetActivity::class.java)
                        .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, item.eventoId)
                )
            } else {
                startActivity(Intent(this, SolicitudesVetActivity::class.java))
            }
        }
        findViewById<RecyclerView>(R.id.rvConsultas).adapter = adapter
    }

    override fun onResume() {
        super.onResume()
        cargar()
    }

    private fun cargar() {
        findViewById<TextView>(R.id.tvGreeting).text = "Hola, ${PerfilVetRepo.nombre} 👋"

        val hoy = AgendaRepo.deHoy()
        val pendientes = SolicitudesRepo.pendientesVeterinario()
        findViewById<TextView>(R.id.tvPacientesHoy).text = AgendaRepo.pacientesHoy().toString()
        findViewById<TextView>(R.id.tvConsultasPendientes).text = hoy.size.toString()
        findViewById<TextView>(R.id.tvSolicitudesCount).text = pendientes.toString()

        val items = mutableListOf<HomeVetItem>()
        hoy.mapTo(items) {
            HomeVetItem(PacientesRepo.porId(it.pacienteId).nombre, it.motivo, it.hora, ItemType.CONSULTA, eventoId = it.id)
        }
        SolicitudesRepo.paraVeterinario
            .filter { it.estado == SolicitudItem.Estado.PENDIENTE }
            .mapTo(items) {
                HomeVetItem("Nueva solicitud de acceso", "${it.solicitante} - ${it.paciente?.nombre.orEmpty()}",
                    "", ItemType.SOLICITUD, it.fotoRes, it.hace)
            }
        adapter.update(items)
    }
}
