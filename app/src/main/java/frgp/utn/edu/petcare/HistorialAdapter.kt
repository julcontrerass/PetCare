package frgp.utn.edu.petcare

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView

data class HistorialItem(
    val title: String,
    val subtitle: String,
    val iconRes: Int,
    val bgColorRes: Int
)

class HistorialAdapter(private val items: List<HistorialItem>) : RecyclerView.Adapter<HistorialAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val iconContainer: FrameLayout = view.findViewById(R.id.icon_container)
        val ivIcon: ImageView = view.findViewById(R.id.ivIcon)
        val tvTitle: TextView = view.findViewById(R.id.tvTitle)
        val tvSubtitle: TextView = view.findViewById(R.id.tvSubtitle)
        val timelineLine: View = view.findViewById(R.id.timeline_line)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_historial_clinico, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvTitle.text = item.title
        holder.tvSubtitle.text = item.subtitle
        holder.ivIcon.setImageResource(item.iconRes)
        holder.iconContainer.backgroundTintList = ContextCompat.getColorStateList(holder.itemView.context, item.bgColorRes)
        
        // Ocultar la línea en el último elemento
        holder.timelineLine.visibility = if (position == items.size - 1) View.INVISIBLE else View.VISIBLE
    }

    override fun getItemCount() = items.size
}