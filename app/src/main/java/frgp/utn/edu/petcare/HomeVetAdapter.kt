package frgp.utn.edu.petcare

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
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
    val timeAgo: String? = null,
    val eventoId: Int? = null,
    val isEnHorario: Boolean = false
)

class HomeVetAdapter(
    private var items: List<HomeVetItem>,
    private val onClick: (HomeVetItem) -> Unit = {}
) : RecyclerView.Adapter<HomeVetAdapter.ViewHolder>() {

    fun update(nuevos: List<HomeVetItem>) {
        items = nuevos
        notifyDataSetChanged()
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val rootLayout: View = view.findViewById(R.id.rootLayout)
        val tvTime: TextView = view.findViewById(R.id.tvTime)
        val cvProfile: CardView = view.findViewById(R.id.cvProfile)
        val ivProfile: ImageView = view.findViewById(R.id.ivProfile)
        val tvTitle: TextView = view.findViewById(R.id.tvTitle)
        val tvSubtitle: TextView = view.findViewById(R.id.tvSubtitle)
        val tvDescription: TextView = view.findViewById(R.id.tvDescription)
        val tvBadge: TextView = view.findViewById(R.id.tvBadge)
        val ivChevron: ImageView = view.findViewById(R.id.ivChevron)
        val divider: View = view.findViewById(R.id.divider)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_home_vet, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        val context = holder.itemView.context
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

        if (item.isEnHorario) {
            holder.rootLayout.setBackgroundResource(R.drawable.bg_item_en_horario)
            holder.tvTime.setTextColor(ContextCompat.getColor(context, R.color.success_green))
            holder.tvTitle.setTextColor(ContextCompat.getColor(context, R.color.success_green))
            holder.tvBadge.visibility = View.VISIBLE
            holder.tvBadge.text = "En horario"
            holder.ivChevron.imageTintList = ColorStateList.valueOf(
                ContextCompat.getColor(context, R.color.success_green)
            )
            holder.divider.visibility = View.GONE
        } else {
            holder.rootLayout.setBackgroundResource(R.drawable.bg_card_white)
            holder.tvTime.setTextColor(ContextCompat.getColor(context, R.color.teal_dark))
            holder.tvTitle.setTextColor(ContextCompat.getColor(context, R.color.brand_navy))
            holder.tvBadge.visibility = View.GONE
            holder.ivChevron.imageTintList = ColorStateList.valueOf(
                ContextCompat.getColor(context, R.color.text_gray)
            )
            holder.divider.visibility = View.GONE
        }

        holder.itemView.setOnClickListener { onClick(item) }
    }

    override fun getItemCount() = items.size
}