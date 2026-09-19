package frgp.utn.edu.petcare

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class RecordatorioItem(
    val title: String,
    val petName: String,
    val date: String,
    val daysLeft: String,
    val iconRes: Int
)

class RecordatoriosAdapter(private val items: List<RecordatorioItem>) : RecyclerView.Adapter<RecordatoriosAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivIcon: ImageView = view.findViewById(R.id.ivIcon)
        val tvTitle: TextView = view.findViewById(R.id.tvTitle)
        val tvPetName: TextView = view.findViewById(R.id.tvPetName)
        val tvDate: TextView = view.findViewById(R.id.tvDate)
        val tvDaysLeft: TextView = view.findViewById(R.id.tvDaysLeft)
        val timelineLine: View = view.findViewById(R.id.timeline_line)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_recordatorio, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvTitle.text = item.title
        holder.tvPetName.text = item.petName
        holder.tvDate.text = item.date
        holder.tvDaysLeft.text = item.daysLeft
        holder.ivIcon.setImageResource(item.iconRes)
        
        // Ocultar la línea en el último elemento
        holder.timelineLine.visibility = if (position == items.size - 1) View.INVISIBLE else View.VISIBLE
    }

    override fun getItemCount() = items.size
}