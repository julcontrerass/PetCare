package frgp.utn.edu.petcare

import android.content.Intent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class PacienteItem(
    val name: String,
    val breed: String,
    val owner: String,
    val photoRes: Int
)

class PacientesAdapter(private val items: List<PacienteItem>) : RecyclerView.Adapter<PacientesAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivPetPhoto: ImageView = view.findViewById(R.id.ivPetPhoto)
        val tvPetName: TextView = view.findViewById(R.id.tvPetName)
        val tvPetBreed: TextView = view.findViewById(R.id.tvPetBreed)
        val tvOwnerName: TextView = view.findViewById(R.id.tvOwnerName)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_paciente, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvPetName.text = item.name
        holder.tvPetBreed.text = item.breed
        holder.tvOwnerName.text = item.owner
        holder.ivPetPhoto.setImageResource(item.photoRes)

        holder.itemView.setOnClickListener {
            val intent = Intent(it.context, DetallePacienteActivity::class.java)
            it.context.startActivity(intent)
        }
    }

    override fun getItemCount() = items.size
}