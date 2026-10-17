package frgp.utn.edu.petcare.ui.veterinario

import android.app.TimePickerDialog
import android.text.InputType
import android.util.Patterns
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.EstadoEvento
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.model.SedeVet
import frgp.utn.edu.petcare.model.TiposMascota
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.ModoDeUso
import frgp.utn.edu.petcare.ui.common.BajaDeCuenta
import frgp.utn.edu.petcare.ui.common.VetUi
import java.time.LocalDate
import kotlinx.coroutines.launch

/** Perfil del veterinario: sus datos, horarios, especialidades, preferencias y cuenta. */
class PerfilVetSeccion(host: HomeVeterinarioActivity) : SeccionVet(host) {

    override val layout = R.layout.seccion_vet_perfil
    override val navId = R.id.nav_mas


    companion object {
        private val claves = listOf("solicitudes", "turnos", "cancelaciones")
        private val etiquetas = arrayOf(
            "Nuevas solicitudes de acceso", "Recordatorios de turnos", "Cancelaciones de turnos"
        )
    }

    private fun elegirFoto() = host.pedirFoto { uri ->
        PerfilVetRepo.cambiarFoto(uri)
        mostrarPerfil()
        Avisos.mostrar(host, "Foto de perfil actualizada correctamente")
    }

    override fun refrescar() = mostrarPerfil()

    override fun configurar() {

        findViewById<View>(R.id.btnEditVetProfilePic)?.setOnClickListener {
            elegirFoto()
        }
        findViewById<View>(R.id.ivVetProfilePic)?.setOnClickListener {
            elegirFoto()
        }

        findViewById<View>(R.id.llVetAgregarSede)?.setOnClickListener {
            if (PerfilVetRepo.sedes.size >= PerfilVetRepo.MAX_SEDES) {
                Avisos.mostrar(host, "Podés cargar hasta ${PerfilVetRepo.MAX_SEDES} lugares de atención")
            } else {
                editarSede(null)
            }
        }
        findViewById<View>(R.id.llVetEspecialidades)?.setOnClickListener { configurarEspecialidades() }
        findViewById<View>(R.id.llVetTiposAnimales)?.setOnClickListener { configurarTiposAnimales() }
        findViewById<View>(R.id.llVetDuraciones)?.setOnClickListener { configurarDuraciones() }

        // Todo veterinario puede cargar sus propias mascotas: el modo dueño está siempre disponible
        findViewById<View>(R.id.optModoDueno)?.let { fila ->
            fila.visibility = if (Sesion.Rol.DUENO in Sesion.rolesDisponibles) View.VISIBLE else View.GONE
            fila.setOnClickListener { ModoDeUso.cambiar(host, Sesion.Rol.DUENO) }
        }
        findViewById<View>(R.id.optEditarPerfil)?.setOnClickListener { editarPerfil() }
        findViewById<View>(R.id.optCambiarPassword)?.setOnClickListener { cambiarPassword() }
        findViewById<View>(R.id.optNotificaciones)?.setOnClickListener { configurarNotificaciones() }
        findViewById<View>(R.id.optEliminarCuenta)?.setOnClickListener { BajaDeCuenta.confirmar(host) }
        findViewById<View>(R.id.optCerrarSesion)?.setOnClickListener {
            Avisos.confirmar(
                host, "¿Cerrar sesión?", "Vas a tener que ingresar de nuevo con tu correo y tu contraseña.",
                textoAceptar = "Cerrar sesión", textoCancelar = "Cancelar", peligro = false, icono = R.drawable.ic_logout
            ) { Sesion.cerrarYVolver(host) }
        }
        mostrarPerfil()
    }

    private fun mostrarPerfil() {
        findViewById<TextView>(R.id.tvNombreVet)?.text = PerfilVetRepo.nombre
        findViewById<TextView>(R.id.tvDatosVet)?.text = "Matrícula ${PerfilVetRepo.matricula}"
        findViewById<TextView>(R.id.tvVetDniValue)?.text = PerfilVetRepo.dni
        findViewById<TextView>(R.id.tvVetPhoneValue)?.text = PerfilVetRepo.telefono
        findViewById<TextView>(R.id.tvVetEmailValue)?.text = PerfilVetRepo.email
        pintarSedes()
        findViewById<TextView>(R.id.tvVetEspecialidadesValue)?.text = PerfilVetRepo.textoEspecialidades()
        findViewById<TextView>(R.id.tvVetTiposAnimalesValue)?.text = PerfilVetRepo.textoTiposAnimales()
        findViewById<TextView>(R.id.tvVetDuracionesValue)?.text = PerfilVetRepo.textoDuraciones()

        VetUi.cargarFotoVet(findViewById<ImageView>(R.id.ivVetProfilePic))
    }

    private fun campo(hint: String, valor: String = "", tipo: Int = InputType.TYPE_CLASS_TEXT) = EditText(host).apply {
        this.hint = hint
        setText(valor)
        inputType = tipo
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(0, 12, 0, 12) }
    }

    private fun formulario(titulo: String, campos: List<EditText>, alGuardar: (AlertDialog) -> Boolean) {
        val layout = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 8)
            campos.forEach { addView(it) }
        }
        val dialog = AlertDialog.Builder(host)
            .setTitle(titulo)
            .setView(ScrollView(host).apply { addView(layout) })
            .setPositiveButton("Guardar", null)
            .setNegativeButton("Cancelar", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                if (alGuardar(dialog)) dialog.dismiss()
            }
        }
        dialog.show()
    }

    private fun seleccionarHora(horaInicial: String, alSeleccionar: (String) -> Unit) {
        val partes = horaInicial.replace(" hs", "").split(":")
        val h = partes.getOrNull(0)?.toIntOrNull() ?: 9
        val m = partes.getOrNull(1)?.toIntOrNull() ?: 0

        TimePickerDialog(host, { _, hourOfDay, minute ->
            val horaFormateada = String.format("%02d:%02d", hourOfDay, minute)
            alSeleccionar(horaFormateada)
        }, h, m, true).show()
    }

    /** Una fila por lugar de atención, con su dirección, sus días y su horario. */
    private fun pintarSedes() {
        val lista = findViewById<LinearLayout>(R.id.llVetSedes)
        lista.removeAllViews()
        val total = PerfilVetRepo.sedes.size
        PerfilVetRepo.sedes.forEachIndexed { i, sede ->
            val fila = host.layoutInflater.inflate(R.layout.item_sede_vet, lista, false)
            fila.findViewById<TextView>(R.id.tvSedeNombre).text =
                if (total > 1 && i == 0) "${sede.nombre} (principal)" else sede.nombre
            fila.findViewById<TextView>(R.id.tvSedeDetalle).text =
                listOf(sede.direccion, sede.textoHorario()).filter { it.isNotBlank() }.joinToString("\n")
            fila.setOnClickListener { editarSede(sede) }
            lista.addView(fila)
        }
        findViewById<View>(R.id.llVetAgregarSede).visibility =
            if (total >= PerfilVetRepo.MAX_SEDES) View.GONE else View.VISIBLE
    }

    /** Alta o edición de un lugar de atención: nombre, dirección, días y horario propios. */
    private fun editarSede(sede: SedeVet?) {
        val puedeBorrar = sede != null && PerfilVetRepo.sedes.size > 1
        EditorSede.mostrar(
            host, sede,
            alGuardar = { nuevo ->
                if (sede == null) PerfilVetRepo.agregarSede(nuevo) else PerfilVetRepo.guardarSede(nuevo)
                mostrarPerfil()
                Avisos.mostrar(host, if (sede == null) "Lugar de atención agregado" else "Lugar de atención actualizado")
            },
            alEliminar = if (puedeBorrar && sede != null) { dialogo -> borrarSede(sede, dialogo) } else null
        )
    }

    private fun borrarSede(sede: SedeVet, dialogo: android.app.Dialog) {
        val hoy = LocalDate.now()
        val conTurnos = AgendaRepo.eventos.any {
            it.sedeId == sede.id && it.estado == EstadoEvento.PENDIENTE && !it.fecha.isBefore(hoy)
        }
        if (conTurnos) {
            Avisos.mostrar(host, "Ese lugar tiene turnos pendientes: cancelalos o pasalos a otro lugar antes de borrarlo")
            return
        }
        Avisos.confirmar(
            host, "¿Eliminar este lugar?", "Los dueños ya no van a poder sacar turnos en ${sede.nombre}.",
            textoAceptar = "Eliminar", textoCancelar = "Cancelar", peligro = true, icono = R.drawable.ic_warning
        ) {
            PerfilVetRepo.eliminarSede(sede.id)
            mostrarPerfil()
            dialogo.dismiss()
        }
    }

    private fun configurarEspecialidades() {
        val marcadas = PerfilVetRepo.especialidadesSeleccionadas.clone()
        AlertDialog.Builder(host)
            .setTitle("Especialidades y prácticas que realizás")
            .setMultiChoiceItems(PerfilVetRepo.todasLasEspecialidades, marcadas) { _, which, checked ->
                marcadas[which] = checked
            }
            .setPositiveButton("Guardar") { _, _ ->
                System.arraycopy(marcadas, 0, PerfilVetRepo.especialidadesSeleccionadas, 0, marcadas.size)
                PerfilVetRepo.guardarEspecialidades()
                mostrarPerfil()
                Avisos.mostrar(host, "Especialidades actualizadas")
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    /** Qué tipos de mascota atiende: los dueños solo pueden sacar turno para esos. */
    private fun configurarTiposAnimales() {
        val hoja = BottomSheetDialog(host)
        val vista = host.layoutInflater.inflate(R.layout.sheet_tipos_animales, null)
        hoja.setContentView(vista)
        val elegidos = PerfilVetRepo.tiposAnimales.toMutableSet()
        val grupo = vista.findViewById<ChipGroup>(R.id.cgTiposAnimales)
        TiposMascota.TODOS.forEach { tipo ->
            val chip = host.layoutInflater.inflate(R.layout.view_chip_registro, grupo, false) as Chip
            chip.text = TiposMascota.plural(tipo)
            chip.isChecked = tipo in elegidos
            chip.setOnCheckedChangeListener { _, marcado ->
                if (marcado) elegidos.add(tipo) else elegidos.remove(tipo)
                if (marcado) vista.findViewById<View>(R.id.tvTiposError).visibility = View.GONE
            }
            grupo.addView(chip)
        }
        vista.findViewById<View>(R.id.btnGuardarTipos).setOnClickListener {
            if (elegidos.isEmpty()) {
                vista.findViewById<View>(R.id.tvTiposError).visibility = View.VISIBLE
                return@setOnClickListener
            }
            PerfilVetRepo.tiposAnimales.clear()
            PerfilVetRepo.tiposAnimales.addAll(TiposMascota.TODOS.filter { it in elegidos })
            PerfilVetRepo.guardarTiposAnimales()
            mostrarPerfil()
            hoja.dismiss()
            Avisos.mostrar(host, "Animales que atendés actualizados")
        }
        vista.findViewById<View>(R.id.btnCancelarTipos).setOnClickListener { hoja.dismiss() }
        hoja.show()
    }

    /** La duración de cada práctica: define cuánto tiempo bloquea en la agenda cada turno. */
    private fun configurarDuraciones() {
        val servicios = PerfilVetRepo.serviciosOfrecidos()
        if (servicios.isEmpty()) {
            Avisos.mostrar(host, "Primero elegí tus especialidades y prácticas")
            return
        }
        val hoja = BottomSheetDialog(host)
        val vista = host.layoutInflater.inflate(R.layout.sheet_duraciones, null)
        hoja.setContentView(vista)
        val valores = servicios.associateWith { PerfilVetRepo.duracionDe(it) }.toMutableMap()

        val lista = vista.findViewById<LinearLayout>(R.id.llDuraciones)
        servicios.forEach { servicio ->
            val fila = host.layoutInflater.inflate(R.layout.item_duracion, lista, false)
            val valor = fila.findViewById<TextView>(R.id.tvDuracionValor)
            val predeterminada = fila.findViewById<TextView>(R.id.tvDuracionPredeterminada)
            val porDefecto = CatalogoMedico.duracionPorDefecto(servicio)
            fun pintar() {
                val minutos = valores.getValue(servicio)
                valor.text = CatalogoMedico.textoDuracion(minutos)
                predeterminada.text = if (minutos == porDefecto) {
                    "Duración habitual"
                } else {
                    "Habitual: ${CatalogoMedico.textoDuracion(porDefecto)}"
                }
            }
            fila.findViewById<TextView>(R.id.tvDuracionNombre).text = servicio
            fila.findViewById<View>(R.id.btnDuracionMenos).setOnClickListener {
                valores[servicio] = (valores.getValue(servicio) - CatalogoMedico.PASO_DURACION_MIN)
                    .coerceAtLeast(CatalogoMedico.DURACION_MINIMA_MIN)
                pintar()
            }
            fila.findViewById<View>(R.id.btnDuracionMas).setOnClickListener {
                valores[servicio] = (valores.getValue(servicio) + CatalogoMedico.PASO_DURACION_MIN)
                    .coerceAtMost(CatalogoMedico.DURACION_MAXIMA_MIN)
                pintar()
            }
            pintar()
            lista.addView(fila)
        }

        vista.findViewById<View>(R.id.btnGuardarDuraciones).setOnClickListener {
            valores.forEach { (servicio, minutos) ->
                if (minutos == CatalogoMedico.duracionPorDefecto(servicio)) PerfilVetRepo.duraciones.remove(servicio)
                else PerfilVetRepo.duraciones[servicio] = minutos
            }
            PerfilVetRepo.guardarDuraciones()
            mostrarPerfil()
            hoja.dismiss()
            Avisos.mostrar(host, "Duración de los turnos actualizada")
        }
        vista.findViewById<View>(R.id.btnCancelarDuraciones).setOnClickListener { hoja.dismiss() }
        hoja.show()
    }

    private fun editarPerfil() {
        val nombre = campo("Nombre y Apellido", PerfilVetRepo.nombre)
        val matricula = campo("Matrícula", PerfilVetRepo.matricula)
        val telefono = campo("Teléfono de Contacto", PerfilVetRepo.telefono, InputType.TYPE_CLASS_PHONE)
        // El correo es el de la cuenta: no se cambia desde el perfil profesional
        val email = campo("Correo Electrónico", PerfilVetRepo.email, InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
            .apply { isEnabled = false }

        formulario("Editar perfil profesional", listOf(nombre, matricula, telefono, email)) {
            var ok = true
            if (nombre.text.isBlank()) { nombre.error = "Requerido"; ok = false }
            if (matricula.text.isBlank()) { matricula.error = "Requerido"; ok = false }
            if (ok) {
                PerfilVetRepo.nombre = nombre.text.toString().trim()
                PerfilVetRepo.matricula = matricula.text.toString().trim()
                PerfilVetRepo.telefono = telefono.text.toString().trim()
                PerfilVetRepo.guardarDatos()
                mostrarPerfil()
                Avisos.mostrar(host, "Perfil profesional actualizado")
            }
            ok
        }
    }

    private fun cambiarPassword() {
        val pass = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        val actual = campo("Contraseña actual", tipo = pass)
        val nueva = campo("Nueva contraseña", tipo = pass)
        val confirmar = campo("Confirmar nueva contraseña", tipo = pass)
        formulario("Cambiar contraseña", listOf(actual, nueva, confirmar)) { dialogo ->
            val error = when {
                actual.text.isEmpty() -> "Ingresá tu contraseña actual"
                nueva.text.length < 6 -> "La nueva contraseña debe tener al menos 6 caracteres"
                nueva.text.toString() != confirmar.text.toString() -> "Las contraseñas no coinciden"
                nueva.text.toString() == actual.text.toString() -> "La nueva contraseña debe ser distinta a la actual"
                else -> null
            }
            if (error != null) {
                Avisos.mostrar(host, error)
            } else {
                val boton = dialogo.getButton(AlertDialog.BUTTON_POSITIVE)
                boton.isEnabled = false
                host.lifecycleScope.launch {
                    try {
                        Servicios.fuente.cambiarPassword(PerfilVetRepo.email, actual.text.toString(), nueva.text.toString())
                        Avisos.mostrar(host, "Contraseña actualizada")
                        dialogo.dismiss()
                    } catch (e: Exception) {
                        boton.isEnabled = true
                        val mensaje = Errores.mensaje(e)
                        Avisos.mostrar(host, if (mensaje.startsWith("Correo o contraseña")) "La contraseña actual es incorrecta" else mensaje)
                    }
                }
            }
            // El diálogo se cierra solo cuando el servidor acepta el cambio
            false
        }
    }

    private fun configurarNotificaciones() {
        val marcadas = BooleanArray(claves.size) { PerfilVetRepo.preferencia(claves[it]) }
        AlertDialog.Builder(host)
            .setTitle("Notificaciones")
            .setMultiChoiceItems(etiquetas, marcadas) { _, which, checked -> marcadas[which] = checked }
            .setPositiveButton("Guardar") { _, _ ->
                claves.forEachIndexed { i, clave -> PerfilVetRepo.preferencias[clave] = marcadas[i] }
                PerfilVetRepo.guardarPreferencias()
                Avisos.mostrar(host, "Preferencias guardadas")
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
