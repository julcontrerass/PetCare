package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.android.material.tabs.TabLayout

class HomeAdminActivity : AppCompatActivity() {

    private lateinit var tabLayout: TabLayout
    private lateinit var rvContent: RecyclerView

    private lateinit var tvCountPendientes: TextView
    private lateinit var tvCountVets: TextView
    private lateinit var tvCountDuenos: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.home_admin)

        tabLayout = findViewById(R.id.tabLayoutAdmin)
        rvContent = findViewById(R.id.rvAdminContent)

        tvCountPendientes = findViewById(R.id.tvCountPendientes)
        tvCountVets = findViewById(R.id.tvCountVets)
        tvCountDuenos = findViewById(R.id.tvCountDuenos)

        findViewById<ImageButton>(R.id.btnLogoutAdmin)?.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Cerrar sesión")
                .setMessage("¿Querés cerrar tu sesión de Administrador?")
                .setPositiveButton("Cerrar sesión") { _, _ ->
                    val intent = Intent(this, MainActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    startActivity(intent)
                }
                .setNegativeButton("Cancelar", null)
                .show()
        }

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                refrescarContenido()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        refrescarContenido()
    }

    override fun onResume() {
        super.onResume()
        refrescarContenido()
    }

    private fun refrescarContenido() {
        val pendientes = AdminRepo.pendientesRevisionCount()
        val totalVets = AdminRepo.listaVeterinarios.size
        val totalDuenos = AdminRepo.listaDuenos.size

        tvCountPendientes.text = pendientes.toString()
        tvCountVets.text = totalVets.toString()
        tvCountDuenos.text = totalDuenos.toString()

        when (tabLayout.selectedTabPosition) {
            0 -> mostrarVeterinarios(AdminRepo.listaVeterinarios.filter { it.estado == "PENDIENTE_REVISION" })
            1 -> mostrarVeterinarios(AdminRepo.listaVeterinarios)
            2 -> mostrarDuenos(AdminRepo.listaDuenos)
            else -> mostrarVeterinarios(AdminRepo.listaVeterinarios)
        }
    }

    private fun mostrarVeterinarios(vets: List<VetAdminItem>) {
        rvContent.adapter = AdminVetAdapter(vets,
            onAprobar = { item ->
                AdminRepo.aprobarVet(item.id)
                Toast.makeText(this, "¡${item.nombre} dado de alta exitosamente!", Toast.LENGTH_SHORT).show()
                refrescarContenido()
            },
            onRechazar = { item ->
                AdminRepo.rechazarVet(item.id)
                Toast.makeText(this, "Solicitud de ${item.nombre} rechazada", Toast.LENGTH_SHORT).show()
                refrescarContenido()
            }
        )
    }

    private fun mostrarDuenos(duenos: List<DuenoAdminItem>) {
        rvContent.adapter = AdminDuenoAdapter(duenos)
    }

    // Adaptador para Veterinarios en el Panel Admin
    private inner class AdminVetAdapter(
        private val items: List<VetAdminItem>,
        private val onAprobar: (VetAdminItem) -> Unit,
        private val onRechazar: (VetAdminItem) -> Unit
    ) : RecyclerView.Adapter<AdminVetAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvNombre: TextView = view.findViewById(R.id.tvVetNombre)
            val tvBadge: TextView = view.findViewById(R.id.tvVetEstadoBadge)
            val tvMatrícula: TextView = view.findViewById(R.id.tvVetMatriculaClinica)
            val tvContacto: TextView = view.findViewById(R.id.tvVetContacto)
            val tvEspecialidad: TextView = view.findViewById(R.id.tvVetEspecialidadHorarios)
            val layoutAcciones: View = view.findViewById(R.id.layoutAccionesRevision)
            val btnAprobar: MaterialButton = view.findViewById(R.id.btnAprobarVet)
            val btnRechazar: MaterialButton = view.findViewById(R.id.btnRechazarVet)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_vet, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.tvNombre.text = item.nombre
            holder.tvMatrícula.text = "Matrícula ${item.matricula} · ${item.clinica}"
            holder.tvContacto.text = "${item.email} · ${item.telefono}"
            holder.tvEspecialidad.text = "Especialidades: ${item.especialidades}"

            if (item.estado == "PENDIENTE_REVISION") {
                holder.tvBadge.text = "EN REVISIÓN DE MATRÍCULA"
                holder.tvBadge.setBackgroundResource(R.drawable.bg_badge_orange)
                holder.tvBadge.setTextColor(getColor(R.color.accent_orange))
                holder.layoutAcciones.visibility = View.VISIBLE
                holder.btnAprobar.setOnClickListener { onAprobar(item) }
                holder.btnRechazar.setOnClickListener { onRechazar(item) }
            } else if (item.estado == "ACTIVO") {
                holder.tvBadge.text = "🟢 ALTA CONFIRMADA"
                holder.tvBadge.setBackgroundResource(R.drawable.bg_badge_green)
                holder.tvBadge.setTextColor(getColor(R.color.success_green))
                holder.layoutAcciones.visibility = View.GONE
            } else {
                holder.tvBadge.text = "🔴 RECHAZADO"
                holder.tvBadge.setBackgroundResource(R.drawable.bg_badge_red)
                holder.tvBadge.setTextColor(getColor(R.color.danger_red))
                holder.layoutAcciones.visibility = View.GONE
            }

            holder.itemView.setOnClickListener {
                AlertDialog.Builder(this@HomeAdminActivity)
                    .setTitle(item.nombre)
                    .setMessage(
                        "Matrícula: ${item.matricula}\n" +
                        "Clínica: ${item.clinica}\n" +
                        "Dirección: ${item.direccion}\n" +
                        "Teléfono: ${item.telefono}\n" +
                        "Email: ${item.email}\n" +
                        "Horarios: ${item.diasYHorarios}\n" +
                        "Especialidades: ${item.especialidades}\n" +
                        "Estado actual: ${item.estado}"
                    )
                    .setPositiveButton("Cerrar", null)
                    .show()
            }
        }

        override fun getItemCount() = items.size
    }

    // Adaptador para Dueños en el Panel Admin
    private inner class AdminDuenoAdapter(
        private val items: List<DuenoAdminItem>
    ) : RecyclerView.Adapter<AdminDuenoAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvNombre: TextView = view.findViewById(R.id.tvDuenoNombre)
            val tvDniEmail: TextView = view.findViewById(R.id.tvDuenoDniEmail)
            val tvContacto: TextView = view.findViewById(R.id.tvDuenoContacto)
            val tvMascotas: TextView = view.findViewById(R.id.tvDuenoMascotas)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_dueno, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.tvNombre.text = item.nombre
            holder.tvDniEmail.text = "DNI: ${item.dni} · ${item.email}"
            holder.tvContacto.text = "${item.telefono} · ${item.direccion}"
            holder.tvMascotas.text = "Mascotas registradas: ${item.mascotas.joinToString(", ")}"

            holder.itemView.setOnClickListener {
                AlertDialog.Builder(this@HomeAdminActivity)
                    .setTitle("Dueño: ${item.nombre}")
                    .setMessage(
                        "DNI: ${item.dni}\n" +
                        "Email: ${item.email}\n" +
                        "Teléfono: ${item.telefono}\n" +
                        "Dirección: ${item.direccion}\n\n" +
                        "Mascotas asociadas:\n" + item.mascotas.joinToString("\n- ", prefix = "- ")
                    )
                    .setPositiveButton("Cerrar", null)
                    .show()
            }
        }

        override fun getItemCount() = items.size
    }
}
