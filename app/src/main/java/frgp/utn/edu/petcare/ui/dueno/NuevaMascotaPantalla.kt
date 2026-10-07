package frgp.utn.edu.petcare.ui.dueno

import android.net.Uri
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.imageview.ShapeableImageView
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.model.Mascota
import java.time.LocalDate

/** Alta de una mascota nueva. */
class NuevaMascotaPantalla(host: DuenoActivity) : Pantalla(host) {

    private var tipo: String? = null
    private var foto: Uri? = null
    private var nacimiento: LocalDate? = null

    fun mostrar() {
        tipo = null
        foto = null
        nacimiento = null
        host.mostrarContenido(R.layout.nueva_mascota, R.id.nav_mascotas)

        val etNombre = vista<EditText>(R.id.etNombreMascota)
        val etRaza = vista<EditText>(R.id.etRaza)
        val etNacimiento = vista<EditText>(R.id.etFechaNacimiento)
        etNacimiento?.apply {
            isFocusable = false
            isClickable = true
            setOnClickListener {
                Componentes.elegirFechaNacimiento(host, nacimiento) { fecha ->
                    nacimiento = fecha
                    setText(Fechas.corta(fecha))
                }
            }
        }

        val tipos = listOf(
            R.id.optTipoPerro to host.getString(R.string.tipo_perro),
            R.id.optTipoGato to host.getString(R.string.tipo_gato),
            R.id.optTipoOtro to host.getString(R.string.tipo_otro)
        )
        tipos.forEach { (id, nombre) ->
            alTocarConRebote(id) {
                tipo = nombre
                pintarTipos(tipos)
            }
        }

        val elegirFoto = { _: android.view.View ->
            host.pedirImagen { uri ->
                foto = uri
                vista<ShapeableImageView>(R.id.ivFotoMascota)?.apply {
                    setPadding(0, 0, 0, 0)
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    setImageURI(uri)
                }
            }
        }
        alTocarConRebote(R.id.ivFotoMascota, elegirFoto)
        alTocarConRebote(R.id.btnSeleccionarFoto, elegirFoto)

        alTocar(R.id.btnBack) { host.irAMascotas() }
        alTocarConRebote(R.id.btnGuardarMascota) {
            val nombre = etNombre?.text?.toString()?.trim().orEmpty()
            val elegido = tipo
            when {
                nombre.isEmpty() -> toast("Ingresá el nombre de la mascota")
                elegido == null -> toast("Seleccioná el tipo de mascota")
                else -> {
                    DuenoRepo.agregarMascota(
                        Mascota(
                            nombre = nombre, tipo = elegido,
                            raza = etRaza?.text?.toString()?.trim().orEmpty(),
                            nacimiento = nacimiento, fotoUri = foto
                        )
                    )
                    toast(R.string.mascota_agregada_msg)
                    host.irAMascotas()
                }
            }
        }
    }

    private fun pintarTipos(tipos: List<Pair<Int, String>>) {
        tipos.forEach { (id, nombre) ->
            val opcion = vista<TextView>(id) ?: return@forEach
            val elegido = nombre == tipo
            opcion.setBackgroundResource(if (elegido) R.drawable.bg_chip_selected else R.drawable.bg_chip_unselected)
            opcion.setTextColor(ContextCompat.getColor(host, if (elegido) R.color.white else R.color.black))
        }
    }
}
