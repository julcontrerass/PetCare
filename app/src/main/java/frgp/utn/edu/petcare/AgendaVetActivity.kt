package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout

class AgendaVetActivity : AppCompatActivity() {

    private lateinit var adapter: AgendaAdapter
    private lateinit var tabLayout: TabLayout
    private lateinit var tvVacia: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.agenda_vet)

        VetBottomNav.setup(this, R.id.nav_agenda)
        findViewById<View>(R.id.toolbar).setOnClickListener {
            val intent = Intent(this, HomeVeterinarioActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            startActivity(intent)
            finish()
        }

        tabLayout = findViewById(R.id.tabLayoutAgenda)
        tvVacia = findViewById(R.id.emptyAgenda)
        listOf("Próximos", "Completados", "Cancelados").forEach { tabLayout.addTab(tabLayout.newTab().setText(it)) }

        adapter = AgendaAdapter()
        findViewById<RecyclerView>(R.id.rvAgenda).adapter = adapter

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

    private fun refrescar() {
        val eventos = when (tabLayout.selectedTabPosition) {
            1 -> AgendaRepo.porEstado(EstadoEvento.COMPLETADO)
            2 -> AgendaRepo.porEstado(EstadoEvento.CANCELADO)
            else -> AgendaRepo.proximos()
        }
        val filas = mutableListOf<AgendaFila>()
        var ultimaFecha: java.time.LocalDate? = null
        for (e in eventos) {
            if (e.fecha != ultimaFecha) {
                filas.add(AgendaFila.Encabezado(Fechas.relativa(e.fecha) + " · " + Fechas.corta(e.fecha)))
                ultimaFecha = e.fecha
            }
            filas.add(AgendaFila.Turno(e))
        }
        adapter.update(filas)
        tvVacia.visibility = if (filas.isEmpty()) View.VISIBLE else View.GONE
        findViewById<View>(R.id.rvAgenda).visibility = if (filas.isEmpty()) View.GONE else View.VISIBLE
        val sinTurnos = when (tabLayout.selectedTabPosition) {
            1 -> "No hay turnos completados"
            2 -> "No hay turnos cancelados"
            else -> "No hay turnos próximos"
        }
        tvVacia.findViewById<android.widget.ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_calendar)
        tvVacia.findViewById<TextView>(R.id.tvEmptyTitle).text = sinTurnos
        tvVacia.findViewById<TextView>(R.id.tvEmptyMessage).text = "Los turnos agendados con vos aparecen acá"
        val cantidad = eventos.size
        findViewById<TextView>(R.id.tvAgendaCount).text = if (cantidad == 1) "1 turno" else "$cantidad turnos"
    }
}

sealed class AgendaFila {
    data class Encabezado(val texto: String) : AgendaFila()
    data class Turno(val evento: EventoVet) : AgendaFila()
}

class AgendaAdapter : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private var items: List<AgendaFila> = emptyList()

    fun update(nuevos: List<AgendaFila>) {
        items = nuevos
        notifyDataSetChanged()
    }

    class HeaderHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tv: TextView = view.findViewById(R.id.tvHeaderFecha)
    }

    class TurnoHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvHora: TextView = view.findViewById(R.id.tvHora)
        val tvPaciente: TextView = view.findViewById(R.id.tvPaciente)
        val tvMotivo: TextView = view.findViewById(R.id.tvMotivo)
        val tvEstado: TextView = view.findViewById(R.id.tvEstadoAgenda)
    }

    override fun getItemViewType(position: Int) = if (items[position] is AgendaFila.Encabezado) 0 else 1

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == 0) HeaderHolder(inflater.inflate(R.layout.item_header_fecha, parent, false))
        else TurnoHolder(inflater.inflate(R.layout.item_agenda_vet, parent, false))
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val fila = items[position]) {
            is AgendaFila.Encabezado -> (holder as HeaderHolder).tv.text = fila.texto
            is AgendaFila.Turno -> {
                val h = holder as TurnoHolder
                val e = fila.evento
                val ctx = h.itemView.context
                h.tvHora.text = e.hora
                h.tvPaciente.text = PacientesRepo.porId(e.pacienteId).nombre
                h.tvMotivo.text = "${e.tipo} · ${e.motivo}"
                h.tvEstado.text = e.estado.etiqueta
                val (fondo, color) = when (e.estado) {
                    EstadoEvento.PENDIENTE -> R.drawable.bg_chip_warn to R.color.accent_orange_dark
                    EstadoEvento.COMPLETADO -> R.drawable.bg_chip_ok to R.color.success_green
                    EstadoEvento.CANCELADO -> R.drawable.bg_chip_danger to R.color.danger_red
                }
                h.tvEstado.setBackgroundResource(fondo)
                h.tvEstado.setTextColor(ContextCompat.getColor(ctx, color))
                h.itemView.setOnClickListener {
                    ctx.startActivity(
                        Intent(ctx, DetalleEventoVetActivity::class.java)
                            .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, e.id)
                    )
                }
            }
        }
    }

    override fun getItemCount() = items.size
}
