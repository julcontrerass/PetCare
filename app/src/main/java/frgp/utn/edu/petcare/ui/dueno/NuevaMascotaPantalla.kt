package frgp.utn.edu.petcare.ui.dueno

import android.net.Uri
import frgp.utn.edu.petcare.ui.common.Efectos
import frgp.utn.edu.petcare.model.TiposMascota
import android.widget.GridLayout
import android.view.Gravity
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

        pintarTipos()

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

    /** Arma las opciones de tipo de animal (perro, gato, ave, reptil, pez, roedor y otro). */
    private fun pintarTipos() {
        val grilla = vista<GridLayout>(R.id.gridTiposMascota) ?: return
        grilla.removeAllViews()
        TiposMascota.TODOS.forEach { nombre ->
            val elegido = nombre == tipo
            val color = ContextCompat.getColor(host, if (elegido) R.color.white else R.color.primary_teal)
            val icono = ContextCompat.getDrawable(host, TiposMascota.icono(nombre))?.mutate()?.apply {
                setTint(color)
                setBounds(0, 0, dp(26), dp(26))
            }
            grilla.addView(TextView(host).apply {
                text = nombre
                gravity = Gravity.CENTER
                textSize = 13.5f
                compoundDrawablePadding = dp(6)
                setCompoundDrawables(null, icono, null, null)
                setPadding(dp(4), dp(12), dp(4), dp(12))
                setBackgroundResource(if (elegido) R.drawable.bg_chip_selected else R.drawable.bg_chip_unselected)
                setTextColor(ContextCompat.getColor(host, if (elegido) R.color.white else R.color.black))
                isClickable = true
                isFocusable = true
                layoutParams = GridLayout.LayoutParams().apply {
                    width = 0
                    height = GridLayout.LayoutParams.WRAP_CONTENT
                    rowSpec = GridLayout.spec(GridLayout.UNDEFINED, GridLayout.FILL)
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, GridLayout.FILL, 1f)
                    setMargins(dp(4), dp(4), dp(4), dp(4))
                }
                setOnClickListener {
                    Efectos.rebote(it)
                    tipo = nombre
                    pintarTipos()
                }
            })
        }
    }
}
