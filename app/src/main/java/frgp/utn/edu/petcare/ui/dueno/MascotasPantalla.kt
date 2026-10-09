package frgp.utn.edu.petcare.ui.dueno

import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.imageview.ShapeableImageView
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.model.Mascota

/** Lista de mascotas con filtro por tipo. */
class MascotasPantalla(host: DuenoActivity) : Pantalla(host) {

    private enum class Filtro(val chipId: Int) {
        TODAS(R.id.chipTodas), PERROS(R.id.chipPerros), GATOS(R.id.chipGatos), OTRAS(R.id.chipOtras);

        fun admite(mascota: Mascota): Boolean {
            val tipo = mascota.tipo.trim().lowercase()
            return when (this) {
                TODAS -> true
                PERROS -> tipo == "perro"
                GATOS -> tipo == "gato"
                OTRAS -> tipo != "perro" && tipo != "gato"
            }
        }
    }

    private var filtro = Filtro.TODAS

    fun mostrar() {
        host.mostrarContenido(R.layout.mis_mascotas, R.id.nav_mascotas)
        filtro = Filtro.TODAS

        alTocar(R.id.btnBack) { host.irAHome() }
        alTocarConRebote(R.id.btnAddPet) { host.irANuevaMascota() }
        alTocarConRebote(R.id.btnAddPetCard) { host.irANuevaMascota() }
        Filtro.entries.forEach { f ->
            alTocar(f.chipId) {
                filtro = f
                actualizarLista()
            }
        }
        actualizarLista()
    }

    private fun actualizarLista() {
        val lista = vista<LinearLayout>(R.id.listaMascotasContainer) ?: return
        lista.removeAllViews()

        val todas = DuenoRepo.mascotas
        val visibles = todas.filter { filtro.admite(it) }
        visibles.forEach { lista.addView(tarjeta(it, lista)) }
        if (visibles.isEmpty()) {
            val vacio = Componentes.estadoVacio(
                host, lista, R.drawable.ic_dog, "No hay mascotas en esta categoría",
                "Probá con otro filtro o agregá una nueva mascota"
            )
            lista.addView(vacio)
            (vacio.layoutParams as LinearLayout.LayoutParams).bottomMargin = dp(14)
        }

        texto(R.id.tvPetsCount, if (todas.size == 1) "1 mascota" else "${todas.size} mascotas")

        Filtro.entries.forEach { f ->
            val chip = vista<TextView>(f.chipId) ?: return@forEach
            val activo = f == filtro
            chip.setBackgroundResource(if (activo) R.drawable.bg_pill_teal else R.drawable.bg_pill_white)
            chip.setTextColor(ContextCompat.getColor(host, if (activo) R.color.white else R.color.text_gray))
        }
    }

    private fun tarjeta(mascota: Mascota, padre: ViewGroup): View {
        val item = host.layoutInflater.inflate(R.layout.item_mascota, padre, false)

        val foto = item.findViewById<ShapeableImageView>(R.id.ivFoto)
        val inicial = item.findViewById<TextView>(R.id.tvInicial)
        inicial.text = mascota.inicial
        Imagenes.mostrar(foto, mascota.fotoUri, mascota.fotoPath) { hayFoto ->
            foto.visibility = if (hayFoto) View.VISIBLE else View.GONE
            inicial.visibility = if (hayFoto) View.GONE else View.VISIBLE
        }

        item.findViewById<TextView>(R.id.tvNombre).text = mascota.nombre
        item.findViewById<TextView>(R.id.tvTipoRaza).text =
            if (mascota.raza.isNotEmpty()) "${mascota.tipo} · ${mascota.raza}" else mascota.tipo

        chip(item.findViewById(R.id.tvChipEdad), mascota.edadTexto())
        chip(item.findViewById(R.id.tvChipPeso), if (mascota.tienePesoValido) mascota.peso else null)
        chip(item.findViewById(R.id.tvChipSexo), mascota.sexo?.etiqueta)

        Componentes.chipEstadoMascota(host, item.findViewById(R.id.tvEstado), mascota.nombre)
        item.findViewById<TextView>(R.id.tvProximo).text =
            proximoEventoTexto(mascota.nombre)?.let { "Próx.: $it" } ?: "Sin eventos próximos"

        item.setOnClickListener { host.irADetalleMascota(mascota) }
        return item
    }

    private fun chip(vista: TextView?, texto: String?) {
        vista ?: return
        if (texto.isNullOrEmpty()) {
            vista.visibility = View.GONE
        } else {
            vista.text = texto
            vista.visibility = View.VISIBLE
        }
    }

    companion object {
        /** "Vacuna · 15 Oct" del próximo evento de la mascota, o null si no tiene ninguno. */
        fun proximoEventoTexto(nombreMascota: String): String? {
            val evento = DuenoRepo.proximoEvento(nombreMascota) ?: return null
            return "${evento.categoria} · ${evento.fecha.dayOfMonth} ${Fechas.mesCorto(evento.fecha.monthValue)}"
        }
    }
}
