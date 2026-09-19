package frgp.utn.edu.petcare

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView

enum class ItemType {
    CONSULTA, SOLICITUD
}

data class HomeVetItem(
    val title: String,
    val subtitle: String,
    val time: String,
    val type: ItemType,
    val profileRes: Int? = null,
    val timeAgo: String? = null
)

class HomeVetAdapter(private val items: List<HomeVetItem>) : RecyclerView.Adapter<HomeVetAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvTime: TextView = view.findViewById(R.id.tvTime)
        val cvProfile: CardView = view.findViewById(R.id.cvProfile)
        val ivProfile: ImageView = view.findViewById(R.id.ivProfile)
        val tvTitle: TextView = view.findViewById(R.id.tvTitle)
        val tvSubtitle: TextView = view.findViewById(R.id.tvSubtitle)
        val tvDescription: TextView = view.findViewById(R.id.tvDescription)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_home_vet, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvTitle.text = item.title
        holder.tvSubtitle.text = item.subtitle
        
        if (item.type == ItemType.CONSULTA) {
            holder.tvTime.visibility = View.VISIBLE
            holder.cvProfile.visibility = View.GONE
            holder.tvTime.text = item.time
            holder.tvDescription.visibility = View.GONE
        } else {
            holder.tvTime.visibility = View.GONE
            holder.cvProfile.visibility = View.VISIBLE
            item.profileRes?.let { holder.ivProfile.setImageResource(it) }
            holder.tvDescription.visibility = View.VISIBLE
            holder.tvDescription.text = item.timeAgo
        }
    }

    override fun getItemCount() = items.size
}