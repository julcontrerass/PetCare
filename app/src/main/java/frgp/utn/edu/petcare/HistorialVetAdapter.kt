package frgp.utn.edu.petcare

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

enum class HistorialCategory {
    TODOS, CONSULTA, VACUNA, TRATAMIENTO, OTROS
}

sealed class HistorialVetUIItem {
    data class Header(val title: String) : HistorialVetUIItem()
    data class Event(
        val day: String,
        val month: String,
        val title: String,
        val doctor: String,
        val notes: String,
        val iconRes: Int,
        val category: HistorialCategory
    ) : HistorialVetUIItem()
}

class HistorialVetAdapter(private var items: List<HistorialVetUIItem>) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        private const val TYPE_HEADER = 0
        private const val TYPE_EVENT = 1
    }

    fun updateItems(newItems: List<HistorialVetUIItem>) {
        this.items = newItems
        notifyDataSetChanged()
    }

    override fun getItemViewType(position: Int): Int {
        return when (items[position]) {
            is HistorialVetUIItem.Header -> TYPE_HEADER
            is HistorialVetUIItem.Event -> TYPE_EVENT
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return if (viewType == TYPE_HEADER) {
            HeaderViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_historial_header_vet, parent, false))
        } else {
            EventViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_historial_vet, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val item = items[position]
        if (holder is HeaderViewHolder && item is HistorialVetUIItem.Header) {
            holder.tvHeader.text = item.title
        } else if (holder is EventViewHolder && item is HistorialVetUIItem.Event) {
            holder.tvDay.text = item.day
            holder.tvMonth.text = item.month
            holder.tvTitle.text = item.title
            holder.tvDoctor.text = item.doctor
            holder.tvNotes.text = item.notes
            holder.ivIcon.setImageResource(item.iconRes)
        }
    }

    override fun getItemCount() = items.size

    class HeaderViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvHeader: TextView = view.findViewById(R.id.tvHeader)
    }

    class EventViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvDay: TextView = view.findViewById(R.id.tvDay)
        val tvMonth: TextView = view.findViewById(R.id.tvMonth)
        val tvTitle: TextView = view.findViewById(R.id.tvTitle)
        val tvDoctor: TextView = view.findViewById(R.id.tvDoctor)
        val tvNotes: TextView = view.findViewById(R.id.tvNotes)
        val ivIcon: ImageView = view.findViewById(R.id.ivIcon)
    }
}