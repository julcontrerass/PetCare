package frgp.utn.edu.petcare

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton

class AdminVetAdapter(
    private var items: List<VetAdminItem>,
    private val alAbrir: (VetAdminItem) -> Unit,
    private val alAprobar: (VetAdminItem) -> Unit,
    private val alRechazar: (VetAdminItem) -> Unit
) : RecyclerView.Adapter<AdminVetAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val iniciales: TextView = view.findViewById(R.id.tvVetIniciales)
        val foto: ImageView = view.findViewById(R.id.ivVetFoto)
        val nombre: TextView = view.findViewById(R.id.tvVetNombre)
        val matriculaClinica: TextView = view.findViewById(R.id.tvVetMatriculaClinica)
        val estado: TextView = view.findViewById(R.id.tvVetEstadoBadge)
        val especialidades: TextView = view.findViewById(R.id.tvVetEspecialidadHorarios)
        val contacto: TextView = view.findViewById(R.id.tvVetContacto)
        val acciones: View = view.findViewById(R.id.layoutAccionesRevision)
        val btnAprobar: MaterialButton = view.findViewById(R.id.btnAprobarVet)
        val btnRechazar: MaterialButton = view.findViewById(R.id.btnRechazarVet)
    }

    fun actualizar(nuevos: List<VetAdminItem>) {
        items = nuevos
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_admin_vet, parent, false))

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        AdminUi.avatar(holder.iniciales, holder.foto, item.nombre, item.fotoPath)
        holder.nombre.text = item.nombre
        holder.matriculaClinica.text = "Matrícula ${item.matricula}\n${item.clinica}"
        AdminUi.aplicar(holder.estado, AdminUi.estiloVet(item.estado))
        holder.especialidades.text = item.especialidades.ifBlank { "Sin especialidades" }
        holder.contacto.text = item.email

        val pendiente = item.estado == AdminRepo.PENDIENTE
        holder.acciones.visibility = if (pendiente) View.VISIBLE else View.GONE
        holder.btnAprobar.setOnClickListener { alAprobar(item) }
        holder.btnRechazar.setOnClickListener { alRechazar(item) }
        holder.itemView.setOnClickListener { alAbrir(item) }
    }

    override fun getItemCount() = items.size
}

class AdminDuenoAdapter(
    private var items: List<DuenoAdminItem>,
    private val alAbrir: (DuenoAdminItem) -> Unit
) : RecyclerView.Adapter<AdminDuenoAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val iniciales: TextView = view.findViewById(R.id.tvDuenoIniciales)
        val foto: ImageView = view.findViewById(R.id.ivDuenoFoto)
        val nombre: TextView = view.findViewById(R.id.tvDuenoNombre)
        val dniEmail: TextView = view.findViewById(R.id.tvDuenoDniEmail)
        val mascotas: TextView = view.findViewById(R.id.tvDuenoMascotas)
        val estado: TextView = view.findViewById(R.id.tvDuenoEstado)
    }

    fun actualizar(nuevos: List<DuenoAdminItem>) {
        items = nuevos
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_admin_dueno, parent, false))

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        AdminUi.avatar(holder.iniciales, holder.foto, item.nombre, item.fotoPath)
        holder.nombre.text = item.nombre
        holder.dniEmail.text = "DNI ${item.dni}\n${item.email}"
        val cantidad = item.mascotas.count { it != "Sin mascotas por ahora" }
        holder.mascotas.text = when (cantidad) {
            0 -> "Sin mascotas"
            1 -> "1 mascota"
            else -> "$cantidad mascotas"
        }
        AdminUi.aplicar(holder.estado, AdminUi.estiloDueno(item.estado))
        holder.itemView.setOnClickListener { alAbrir(item) }
    }

    override fun getItemCount() = items.size
}

class AdminActividadAdapter(private var items: List<ActividadAdmin>) :
    RecyclerView.Adapter<AdminActividadAdapter.ViewHolder>() {

    class ViewHolder(val vista: View) : RecyclerView.ViewHolder(vista)

    fun actualizar(nuevos: List<ActividadAdmin>) {
        items = nuevos
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_admin_actividad, parent, false))

    override fun onBindViewHolder(holder: ViewHolder, position: Int) =
        AdminUi.enlazarActividad(holder.vista, items[position])

    override fun getItemCount() = items.size
}
