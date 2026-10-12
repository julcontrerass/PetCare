package frgp.utn.edu.petcare.ui.veterinario

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import frgp.utn.edu.petcare.data.repositorio.Paciente
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.repositorio.RegistroSalud
import frgp.utn.edu.petcare.data.repositorio.SaludRepo
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.BaseActivity
import frgp.utn.edu.petcare.ui.common.Contacto
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Pacientes a los que hay que avisarles que les toca (o se les pasó) una vacuna: las dosis vencidas y las que
 * vencen en los próximos 30 días, con atajos para escribirle al dueño.
 */
class VacunasPendientesActivity : BaseActivity() {

    private lateinit var adapter: VacunasPendientesAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.activity_vacunas_pendientes)

        VetBottomNav.setup(this, R.id.nav_inicio)
        findViewById<View>(R.id.toolbar).setOnClickListener { finish() }

        adapter = VacunasPendientesAdapter(emptyList()) { v, canal -> avisar(v, canal) }
        findViewById<RecyclerView>(R.id.rvVacunas).adapter = adapter
        mostrar()
    }

    override fun onResume() {
        super.onResume()
        if (isFinishing) return
        actualizarDatosVeterinario { mostrar() }
    }

    private fun mostrar() {
        val lista = SaludRepo.vacunasARecordar()
        adapter.actualizar(lista)
        findViewById<TextView>(R.id.tvVacunasCount).text = when (lista.size) {
            0 -> "Todo al día"
            1 -> "1 vacuna para recordar"
            else -> "${lista.size} vacunas para recordar"
        }
        val vacio = findViewById<View>(R.id.emptyVacunas)
        vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
        findViewById<RecyclerView>(R.id.rvVacunas).visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_syringe)
        vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "No hay vacunas para recordar"
        vacio.findViewById<TextView>(R.id.tvEmptyMessage).text =
            "Acá aparecen las vacunas vencidas o que vencen en los próximos 30 días"
    }

    private fun avisar(v: RegistroSalud, canal: Canal) {
        val paciente = PacientesRepo.porId(v.mascotaId)
        val telefono = paciente?.telefono.orEmpty()
        when (canal) {
            Canal.LLAMAR -> Contacto.abrir(this, Contacto.llamar(telefono), "No hay un teléfono cargado para este dueño")
            Canal.WHATSAPP -> Contacto.abrir(
                this, Contacto.whatsApp(telefono, mensaje(v, paciente)), "No hay un teléfono válido para este dueño"
            )
        }
    }

    private fun mensaje(v: RegistroSalud, paciente: Paciente?): String {
        val clinica = PerfilVetRepo.clinica.ifBlank { "la veterinaria" }
        val dueno = paciente?.propietario?.takeIf { it != "Sin datos" }?.substringBefore(' ')
        val saludo = if (dueno != null) "Hola $dueno" else "Hola"
        val fecha = v.proximaDosis?.let { Fechas.corta(it) }.orEmpty()
        val estado = if (v.proximaDosis?.isBefore(LocalDate.now()) == true) "venció el $fecha" else "le toca el $fecha"
        return "$saludo, te escribo de $clinica. A ${v.mascota} la vacuna ${v.titulo} $estado. " +
            "¿Querés que te saque un turno para aplicarla?"
    }

    enum class Canal { WHATSAPP, LLAMAR }
}

class VacunasPendientesAdapter(
    private var items: List<RegistroSalud>,
    private val alAvisar: (RegistroSalud, VacunasPendientesActivity.Canal) -> Unit
) : RecyclerView.Adapter<VacunasPendientesAdapter.ViewHolder>() {

    class ViewHolder(vista: View) : RecyclerView.ViewHolder(vista) {
        val paciente: TextView = vista.findViewById(R.id.tvVacPaciente)
        val vacuna: TextView = vista.findViewById(R.id.tvVacVacuna)
        val dueno: TextView = vista.findViewById(R.id.tvVacDueno)
        val estado: TextView = vista.findViewById(R.id.tvVacEstado)
        val whatsApp: View = vista.findViewById(R.id.btnVacWhatsApp)
        val llamar: View = vista.findViewById(R.id.btnVacLlamar)
    }

    fun actualizar(nuevos: List<RegistroSalud>) {
        items = nuevos
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(padre: ViewGroup, tipo: Int) =
        ViewHolder(LayoutInflater.from(padre.context).inflate(R.layout.item_vacuna_pendiente, padre, false))

    override fun onBindViewHolder(h: ViewHolder, posicion: Int) {
        val v = items[posicion]
        val contexto = h.itemView.context
        val paciente = PacientesRepo.porId(v.mascotaId)
        h.paciente.text = v.mascota
        h.vacuna.text = v.titulo
        h.dueno.text = "Dueño: ${paciente?.propietario ?: "Sin datos"} · ${paciente?.telefono ?: "Sin teléfono"}"

        val dias = v.proximaDosis?.let { ChronoUnit.DAYS.between(LocalDate.now(), it) } ?: 0
        val (texto, fondo, color) = when {
            dias < 0 -> Triple("Vencida hace ${-dias} d", R.drawable.bg_chip_danger, R.color.danger_red)
            dias == 0L -> Triple("Vence hoy", R.drawable.bg_chip_warn, R.color.accent_orange_dark)
            else -> Triple("En $dias d", R.drawable.bg_chip_warn, R.color.accent_orange_dark)
        }
        h.estado.text = texto
        h.estado.setBackgroundResource(fondo)
        h.estado.setTextColor(ContextCompat.getColor(contexto, color))

        h.whatsApp.setOnClickListener { alAvisar(v, VacunasPendientesActivity.Canal.WHATSAPP) }
        h.llamar.setOnClickListener { alAvisar(v, VacunasPendientesActivity.Canal.LLAMAR) }
    }

    override fun getItemCount() = items.size
}
