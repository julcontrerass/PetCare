package frgp.utn.edu.petcare

import android.content.Intent
import frgp.utn.edu.petcare.data.Imagenes
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class PacientesAdapter(private var items: List<Paciente>) : RecyclerView.Adapter<PacientesAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivPetPhoto: ImageView = view.findViewById(R.id.ivPetPhoto)
        val tvPetName: TextView = view.findViewById(R.id.tvPetName)
        val tvPetBreed: TextView = view.findViewById(R.id.tvPetBreed)
        val tvOwnerName: TextView = view.findViewById(R.id.tvOwnerName)
        val tvProximoTurno: TextView = view.findViewById(R.id.tvProximoTurno)
    }

    fun updateItems(newItems: List<Paciente>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_paciente, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvPetName.text = item.nombre
        holder.tvPetBreed.text = item.razaYSexo
        holder.tvOwnerName.text = item.propietario
        val proximo = AgendaRepo.proximoEvento(item.id)
        holder.tvProximoTurno.text =
            if (proximo != null) "Próximo turno · ${Fechas.relativa(proximo.fecha)} ${proximo.hora}" else "Sin turnos próximos"
        holder.ivPetPhoto.setImageResource(R.drawable.ic_dog)
        Imagenes.mostrar(holder.ivPetPhoto, null, item.fotoPath)

        holder.itemView.setOnClickListener {
            val intent = Intent(it.context, DetallePacienteActivity::class.java)
            intent.putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, item.id)
            it.context.startActivity(intent)
        }
    }

    override fun getItemCount() = items.size
}
