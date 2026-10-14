package frgp.utn.edu.petcare.ui.veterinario

import android.content.Intent
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.EventoVet
import frgp.utn.edu.petcare.data.repositorio.NotificacionesVet
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.repositorio.SaludRepo
import frgp.utn.edu.petcare.data.repositorio.SolicitudesRepo
import frgp.utn.edu.petcare.ui.common.VetUi
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalTime
import kotlin.math.abs

/** Inicio del veterinario: lo que tiene hoy, las solicitudes y las vacunas por recordar. */
class InicioVetSeccion(host: HomeVeterinarioActivity) : SeccionVet(host) {

    override val layout = R.layout.seccion_vet_inicio
    override val navId = R.id.nav_inicio

    private lateinit var adapter: HomeVetAdapter

    override fun configurar() {
        findViewById<View>(R.id.ivNotifications).setOnClickListener {
            NotificacionesVet.mostrar(host) { actualizarPuntoDeAvisos() }
        }
        findViewById<View>(R.id.tvVerAgenda).setOnClickListener { host.irA(R.id.nav_agenda) }
        findViewById<View>(R.id.tileSolicitudes).setOnClickListener {
            host.startActivity(Intent(host, SolicitudesVetActivity::class.java))
        }
        findViewById<View>(R.id.cardVacunasARecordar).setOnClickListener {
            host.startActivity(Intent(host, VacunasPendientesActivity::class.java))
        }
        findViewById<View>(R.id.cvVetProfile).setOnClickListener { host.irA(R.id.nav_mas) }

        adapter = HomeVetAdapter(emptyList()) { item ->
            if (item.type == ItemType.CONSULTA && item.eventoId != null) {
                host.startActivity(
                    Intent(host, DetalleEventoVetActivity::class.java)
                        .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, item.eventoId)
                )
            }
        }
        findViewById<RecyclerView>(R.id.rvConsultas).adapter = adapter
    }

    private fun actualizarPuntoDeAvisos() {
        findViewById<View>(R.id.vetNotifBadge).visibility =
            if (NotificacionesVet.hayNuevas) View.VISIBLE else View.GONE
    }

    override fun refrescar() {
        actualizarPuntoDeAvisos()
        findViewById<TextView>(R.id.tvGreeting).text = "Hola, ${PerfilVetRepo.nombre}"
        VetUi.cargarFotoVet(findViewById(R.id.ivVetHomeFoto))
        val hoyFecha = java.time.LocalDate.now()
        findViewById<TextView>(R.id.tvVetDate).text =
            "${DIAS[hoyFecha.dayOfWeek.value - 1]} ${hoyFecha.dayOfMonth} de ${Fechas.mesAnio(hoyFecha).substringBefore(' ').lowercase()}"
        findViewById<TextView>(R.id.tvSolicitudesPend).text = SolicitudesRepo.pendientesVeterinario().toString()
        val aRecordar = SaludRepo.vacunasARecordar().size
        findViewById<TextView>(R.id.tvVacunasARecordar).text = when (aRecordar) {
            0 -> "Todo al día"
            1 -> "1 paciente con una vacuna vencida o por vencer"
            else -> "$aRecordar vacunas vencidas o por vencer"
        }

        val hoy = AgendaRepo.deHoy()
        findViewById<TextView>(R.id.tvPacientesHoy).text = AgendaRepo.pacientesHoy().toString()
        findViewById<TextView>(R.id.tvConsultasPendientes).text = hoy.size.toString()

        val now = LocalTime.now()
        val nowMin = now.hour * 60 + now.minute

        val enHorarioEventoId = hoy.firstOrNull { evento ->
            try {
                val parts = evento.hora.split(":")
                val h = parts[0].toInt()
                val m = parts[1].toInt()
                val eventoMin = h * 60 + m
                abs(nowMin - eventoMin) <= 45 || now.hour == h
            } catch (e: Exception) {
                false
            }
        }?.id

        val items = mutableListOf<HomeVetItem>()
        hoy.mapTo(items) {
            val esEnHorario = (it.id == enHorarioEventoId)
            HomeVetItem(
                title = PacientesRepo.nombreDe(it.pacienteId),
                subtitle = it.motivo,
                time = it.hora,
                type = ItemType.CONSULTA,
                eventoId = it.id,
                isEnHorario = esEnHorario,
                fotoDueno = PacientesRepo.fotoDuenoDe(it.pacienteId)
            )
        }
        adapter.update(items)

        val vacio = findViewById<View>(R.id.emptyConsultas)
        vacio.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
        findViewById<RecyclerView>(R.id.rvConsultas).visibility = if (items.isEmpty()) View.GONE else View.VISIBLE
        vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_calendar)
        vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "Sin consultas para hoy"
        vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = "Cuando agenden un turno con vos aparece acá"

        configurarHero(hoy, enHorarioEventoId)
    }

    private fun configurarHero(hoy: List<EventoVet>, enHorarioEventoId: String?) {
        val titulo = findViewById<TextView>(R.id.tvHeroTitle)
        val subtitulo = findViewById<TextView>(R.id.tvHeroSubtitle)
        val boton = findViewById<TextView>(R.id.btnHeroAction)
        val icono = findViewById<ImageView>(R.id.ivHeroIcon)
        val siguiente = hoy.firstOrNull { it.id == enHorarioEventoId } ?: hoy.firstOrNull()

        if (siguiente == null) {
            findViewById<TextView>(R.id.tvHeroLabel).text = "Agenda libre"
            titulo.text = "Sin consultas hoy"
            subtitulo.text = "Revisá la agenda o cargá una consulta nueva."
            boton.text = "Ver agenda"
            icono.setImageResource(R.drawable.ic_check)
            boton.setOnClickListener { host.irA(R.id.nav_agenda) }
            return
        }
        val paciente = PacientesRepo.porId(siguiente.pacienteId)
        findViewById<TextView>(R.id.tvHeroLabel).text =
            if (siguiente.id == enHorarioEventoId) "En horario" else "Próxima consulta"
        titulo.text = "${paciente?.nombre ?: "Paciente"} · ${siguiente.hora}"
        subtitulo.text = "${siguiente.motivo} · ${paciente?.propietario.orEmpty()}"
        boton.text = "Ver turno"
        icono.setImageResource(R.drawable.ic_calendar)
        boton.setOnClickListener {
            host.startActivity(
                Intent(host, DetalleEventoVetActivity::class.java)
                    .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, siguiente.id)
            )
        }
    }

    private companion object {
        val DIAS = arrayOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
    }
}
