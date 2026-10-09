package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import frgp.utn.edu.petcare.data.Imagenes

class SolicitudesVetActivity : BaseActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.solicitudes_vet)

        VetBottomNav.setup(this, R.id.nav_inicio)
        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }

        val lista = SolicitudesRepo.paraVeterinario
        val pendientes = lista.count { it.estado == SolicitudItem.Estado.PENDIENTE }
        findViewById<TextView>(R.id.tvSolicitudesCount).text =
            if (pendientes == 1) "1 pendiente" else "$pendientes pendientes"
        val vacio = findViewById<View>(R.id.emptySolicitudes)
        vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
        vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_person)
        vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "Sin solicitudes"
        vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = "Cuando un dueño pida acceso aparece acá"

        findViewById<RecyclerView>(R.id.rvSolicitudes).adapter =
            SolicitudesAdapter(lista) { item, estado ->
                val restantes = lista.count { it.estado == SolicitudItem.Estado.PENDIENTE }
                findViewById<TextView>(R.id.tvSolicitudesCount).text =
                    if (restantes == 1) "1 pendiente" else "$restantes pendientes"
                val aceptada = estado == SolicitudItem.Estado.ACEPTADA
                SolicitudesRepo.resolver(item, aceptada)
                Toast.makeText(
                    this, if (aceptada) "La mascota se sumó a tus pacientes" else "Solicitud rechazada", Toast.LENGTH_SHORT
                ).show()
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
        holder.ivFoto.setImageResource(R.drawable.avatar_default)
        Imagenes.mostrar(holder.ivFoto, null, item.fotoPath)
        holder.tvSolicitante.text = item.solicitante
        holder.tvMascota.text = item.mascota
        holder.tvHace.text = item.hace

        val pendiente = item.estado == SolicitudItem.Estado.PENDIENTE
        holder.llAcciones.visibility = if (pendiente) View.VISIBLE else View.GONE
        holder.tvEstado.visibility = if (pendiente) View.GONE else View.VISIBLE
        if (!pendiente) {
            val aceptada = item.estado == SolicitudItem.Estado.ACEPTADA
            holder.tvEstado.text = if (aceptada) "Solicitud aceptada" else "Solicitud rechazada"
            holder.tvEstado.setBackgroundResource(if (aceptada) R.drawable.bg_chip_ok else R.drawable.bg_chip_danger)
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
