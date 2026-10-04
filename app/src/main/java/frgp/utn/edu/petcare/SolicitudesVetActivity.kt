package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.RecyclerView

class SolicitudesVetActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.solicitudes_vet)

        VetBottomNav.setup(this, R.id.nav_inicio)
        findViewById<Toolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }

        findViewById<RecyclerView>(R.id.rvSolicitudes).adapter =
            SolicitudesAdapter(SolicitudesRepo.paraVeterinario) { item, estado ->
                if (estado == SolicitudItem.Estado.ACEPTADA) {
                    item.paciente?.let { PacientesRepo.agregar(it) }
                    Toast.makeText(this, "${item.paciente?.nombre ?: "Paciente"} se sumó a tus pacientes", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Solicitud rechazada", Toast.LENGTH_SHORT).show()
                }
            }
    }
}

class SolicitudesAdapter(
    private val items: List<SolicitudItem>,
    private val onResuelta: (SolicitudItem, SolicitudItem.Estado) -> Unit = { _, _ -> }
) :
    RecyclerView.Adapter<SolicitudesAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivFoto: ImageView = view.findViewById(R.id.ivSolicitud)
        val tvSolicitante: TextView = view.findViewById(R.id.tvSolicitante)
        val tvMascota: TextView = view.findViewById(R.id.tvMascota)
        val tvHace: TextView = view.findViewById(R.id.tvHace)
        val llAcciones: View = view.findViewById(R.id.llAcciones)
        val tvEstado: TextView = view.findViewById(R.id.tvEstado)
        val btnAceptar: View = view.findViewById(R.id.btnAceptar)
        val btnRechazar: View = view.findViewById(R.id.btnRechazar)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder =
        ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_solicitud_vet, parent, false))

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.ivFoto.setImageResource(item.fotoRes)
        holder.tvSolicitante.text = item.solicitante
        holder.tvMascota.text = item.mascota
        holder.tvHace.text = item.hace

        val pendiente = item.estado == SolicitudItem.Estado.PENDIENTE
        holder.llAcciones.visibility = if (pendiente) View.VISIBLE else View.GONE
        holder.tvEstado.visibility = if (pendiente) View.GONE else View.VISIBLE
        if (!pendiente) {
            val aceptada = item.estado == SolicitudItem.Estado.ACEPTADA
            holder.tvEstado.text = if (aceptada) "Solicitud aceptada" else "Solicitud rechazada"
            holder.tvEstado.setTextColor(
                holder.itemView.context.getColor(if (aceptada) R.color.success_green else R.color.danger_red)
            )
        }

        holder.btnAceptar.setOnClickListener { resolver(holder, SolicitudItem.Estado.ACEPTADA) }
        holder.btnRechazar.setOnClickListener { resolver(holder, SolicitudItem.Estado.RECHAZADA) }
    }

    private fun resolver(holder: ViewHolder, estado: SolicitudItem.Estado) {
        val pos = holder.bindingAdapterPosition
        if (pos == RecyclerView.NO_POSITION) return
        items[pos].estado = estado
        notifyItemChanged(pos)
        onResuelta(items[pos], estado)
    }

    override fun getItemCount() = items.size
}
