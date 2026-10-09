package frgp.utn.edu.petcare.ui.dueno

import android.net.Uri
import android.text.InputType
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.appcompat.app.AlertDialog
import com.google.android.material.imageview.ShapeableImageView
import frgp.utn.edu.petcare.R
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.Servicios
import kotlinx.coroutines.launch
import frgp.utn.edu.petcare.model.AjusteFoto
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.ui.common.BajaDeCuenta
import frgp.utn.edu.petcare.ui.common.Efectos

private fun AjusteFoto.escala() = when (this) {
    AjusteFoto.LLENAR -> ImageView.ScaleType.CENTER_CROP
    AjusteFoto.COMPLETA -> ImageView.ScaleType.FIT_CENTER
    AjusteFoto.CENTRADA -> ImageView.ScaleType.CENTER
}

/** Mi perfil: foto, datos de la cuenta y accesos a veterinarios, edición, contraseña y cierre de sesión. */
class PerfilPantalla(host: DuenoActivity) : Pantalla(host) {

    fun mostrar() {
        host.mostrarContenido(R.layout.mi_perfil, R.id.nav_mas)
        val perfil = DuenoRepo.perfil

        alTocar(R.id.btnBack) { host.irAHome() }
        texto(R.id.tvPerfilMascotas, DuenoRepo.mascotas.size.toString())
        texto(R.id.tvPerfilVets, DuenoRepo.autorizados.count { it.estado == EstadoAcceso.ACTIVO }.toString())

        vista<ShapeableImageView>(R.id.ivProfilePic)?.let { imagen ->
            imagen.setImageResource(R.drawable.avatar_default)
            Imagenes.mostrar(imagen, perfil.fotoUri, perfil.fotoPath)
            imagen.translationX = perfil.desplazamientoFotoX
            imagen.translationY = perfil.desplazamientoFotoY
            imagen.scaleType = perfil.ajusteFoto.escala()
            imagen.setOnClickListener {
                if (perfil.fotoUri == null && perfil.fotoPath == null) {
                    toast("Primero elegí una foto tocando el ícono del lápiz")
                    return@setOnClickListener
                }
                Efectos.rebote(it)
                elegirAjusteDeFoto(imagen)
            }
        }
        alTocarConRebote(R.id.btnEditProfilePic) { host.pedirImagen { recortarFoto(it) } }

        texto(R.id.tvUserName, perfil.nombre)
        texto(R.id.tvUserEmailValue, perfil.email)
        texto(R.id.tvUserPhoneValue, perfil.telefono)
        texto(R.id.tvUserAddressValue, perfil.direccion)

        alTocar(R.id.llVeterinarios) { host.irAVeterinarios() }
        alTocar(R.id.llEditarDatos) { host.irAEditarPerfil() }
        alTocar(R.id.llCambiarContrasena) { cambiarPassword() }
        alTocar(R.id.llCerrarSesion) { host.cerrarSesion() }
        alTocar(R.id.llEliminarCuenta) { BajaDeCuenta.confirmar(host) }
    }

    private fun elegirAjusteDeFoto(imagen: ImageView) {
        val opciones = arrayOf("Llenar círculo (Center Crop)", "Ajustar completa (Fit Center)", "Centrar imagen")
        val ajustes = AjusteFoto.entries
        val avisos = arrayOf("Ajustado: Llenar círculo", "Ajustado: Mostrar completa", "Ajustado: Centrar imagen")
        AlertDialog.Builder(host)
            .setTitle("Ajustar posición de la foto")
            .setItems(opciones) { _, cual ->
                DuenoRepo.perfil.ajusteFoto = ajustes[cual]
                imagen.scaleType = ajustes[cual].escala()
                DuenoRepo.guardarAjusteFoto()
                toast(avisos[cual])
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    /** Deja arrastrar la imagen elegida dentro del círculo antes de guardarla como foto de perfil. */
    private fun recortarFoto(uri: Uri) {
        val layoutDialogo = host.layoutInflater.inflate(R.layout.dialog_crop_photo, null)
        val marco = layoutDialogo.findViewById<View>(R.id.frameCropContainer)
        val previsualizacion = layoutDialogo.findViewById<ImageView>(R.id.imgCropPreview)
        previsualizacion.setImageURI(uri)

        var ultimoX = 0f
        var ultimoY = 0f
        val arrastrar = View.OnTouchListener { v, evento ->
            when (evento.action) {
                MotionEvent.ACTION_DOWN -> {
                    ultimoX = evento.rawX
                    ultimoY = evento.rawY
                }
                MotionEvent.ACTION_MOVE -> {
                    previsualizacion.translationX += evento.rawX - ultimoX
                    previsualizacion.translationY += evento.rawY - ultimoY
                    ultimoX = evento.rawX
                    ultimoY = evento.rawY
                }
                MotionEvent.ACTION_UP -> v.performClick()
            }
            true
        }
        marco?.setOnTouchListener(arrastrar)
        previsualizacion.setOnTouchListener(arrastrar)

        val dialogo = AlertDialog.Builder(host).setView(layoutDialogo).setCancelable(true).create()
        layoutDialogo.findViewById<Button>(R.id.btnCancelCrop).setOnClickListener { dialogo.dismiss() }
        layoutDialogo.findViewById<Button>(R.id.btnSaveCrop).setOnClickListener {
            val perfil = DuenoRepo.perfil
            // La imagen de la vista previa mide 400dp y la del perfil 120dp: el desplazamiento se escala 120/400
            perfil.desplazamientoFotoX = previsualizacion.translationX * 0.3f
            perfil.desplazamientoFotoY = previsualizacion.translationY * 0.3f
            DuenoRepo.cambiarFotoPerfil(uri)
            vista<ShapeableImageView>(R.id.ivProfilePic)?.let {
                it.setImageURI(uri)
                it.scaleType = perfil.ajusteFoto.escala()
                it.translationX = perfil.desplazamientoFotoX
                it.translationY = perfil.desplazamientoFotoY
            }
            toast("Foto de perfil actualizada")
            dialogo.dismiss()
        }
        dialogo.show()
    }

    private fun campoPassword(pista: String) = EditText(host).apply {
        hint = pista
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(8) }
    }

    private fun cambiarPassword() {
        val etActual = campoPassword("Contraseña actual")
        val etNueva = campoPassword("Nueva contraseña")
        val etConfirmar = campoPassword("Confirmar nueva contraseña")
        val formulario = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(4))
            addView(etActual)
            addView(etNueva)
            addView(etConfirmar)
        }

        val dialogo = AlertDialog.Builder(host)
            .setTitle("Cambiar contraseña")
            .setView(formulario)
            .setPositiveButton("Guardar", null)
            .setNegativeButton(R.string.btn_cancelar, null)
            .create()
        dialogo.setOnShowListener {
            dialogo.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val actual = etActual.text.toString()
                val nueva = etNueva.text.toString()
                val error = when {
                    actual.isEmpty() -> "Ingresá tu contraseña actual"
                    nueva.length < 6 -> "La nueva contraseña debe tener al menos 6 caracteres"
                    nueva != etConfirmar.text.toString() -> "Las contraseñas no coinciden"
                    nueva == actual -> "La nueva contraseña debe ser distinta a la actual"
                    else -> null
                }
                if (error != null) {
                    toast(error)
                    return@setOnClickListener
                }
                val boton = dialogo.getButton(AlertDialog.BUTTON_POSITIVE)
                boton.isEnabled = false
                host.lifecycleScope.launch {
                    try {
                        Servicios.fuente.cambiarPassword(DuenoRepo.perfil.email, actual, nueva)
                        toast("Contraseña actualizada")
                        dialogo.dismiss()
                    } catch (e: Exception) {
                        boton.isEnabled = true
                        val mensaje = Errores.mensaje(e)
                        toast(if (mensaje.startsWith("Correo o contraseña")) "La contraseña actual es incorrecta" else mensaje)
                    }
                }
            }
        }
        dialogo.show()
    }
}

/** Formulario para editar nombre, correo, teléfono y dirección. */
class EditarPerfilPantalla(host: DuenoActivity) : Pantalla(host) {

    fun mostrar() {
        host.mostrarContenido(R.layout.editar_perfil, R.id.nav_mas)
        val perfil = DuenoRepo.perfil

        val etNombre = vista<EditText>(R.id.etNombreCompleto)
        val etCorreo = vista<EditText>(R.id.etCorreo)
        val etTelefono = vista<EditText>(R.id.etTelefono)
        val etDireccion = vista<EditText>(R.id.etDireccion)
        etNombre?.setText(perfil.nombre)
        etCorreo?.setText(perfil.email)
        // El correo es el de la cuenta: se cambia desde la configuración de acceso, no desde el perfil
        etCorreo?.isEnabled = false
        etTelefono?.setText(perfil.telefono)
        etDireccion?.setText(perfil.direccion)

        alTocar(R.id.btnBack) { host.irAPerfil() }
        alTocarConRebote(R.id.btnGuardarPerfil) {
            val nombre = etNombre?.text?.toString()?.trim().orEmpty()
            if (nombre.isEmpty()) {
                toast("Completá tu nombre")
                return@alTocarConRebote
            }
            DuenoRepo.guardarPerfil(
                nombre,
                etTelefono?.text?.toString()?.trim().orEmpty(),
                etDireccion?.text?.toString()?.trim().orEmpty()
            )
            toast(R.string.perfil_actualizado_msg)
            host.irAPerfil()
        }
    }
}
