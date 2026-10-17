package frgp.utn.edu.petcare.ui.veterinario

import android.app.Dialog
import android.app.TimePickerDialog
import android.view.View
import android.view.WindowManager
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.model.SedeVet

/**
 * Hoja para cargar o editar una veterinaria donde atiende el veterinario: nombre, dirección, días y horario propios.
 * La usan el perfil y el registro; lo único que cambia es qué hacen con el lugar guardado.
 */
object EditorSede {

    /**
     * Abre la hoja para [sede] (null para una nueva). [alGuardar] recibe el lugar ya validado; si hay [alEliminar]
     * se ofrece "Eliminar este lugar" y quien llama decide si se puede y qué más hacer.
     */
    fun mostrar(
        activity: AppCompatActivity, sede: SedeVet?, alGuardar: (SedeVet) -> Unit,
        alEliminar: ((Dialog) -> Unit)? = null
    ) {
        val hoja = BottomSheetDialog(activity)
        val vista = activity.layoutInflater.inflate(R.layout.sheet_sede_vet, null)
        hoja.setContentView(vista)
        hoja.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        hoja.behavior.skipCollapsed = true
        hoja.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val etNombre = vista.findViewById<EditText>(R.id.etSedeNombre)
        val etDireccion = vista.findViewById<EditText>(R.id.etSedeDireccion)
        val etApertura = vista.findViewById<EditText>(R.id.etSedeApertura)
        val etCierre = vista.findViewById<EditText>(R.id.etSedeCierre)
        val resumen = vista.findViewById<TextView>(R.id.tvSedeResumen)
        val grupoDias = vista.findViewById<ChipGroup>(R.id.cgSedeDias)

        vista.findViewById<TextView>(R.id.tvSedeTitulo).text =
            if (sede == null) "Agregar otra veterinaria" else "Editar veterinaria"
        etNombre.setText(sede?.nombre.orEmpty())
        etDireccion.setText(sede?.direccion.orEmpty())

        var apertura = sede?.apertura ?: "09:00"
        var cierre = sede?.cierre ?: "18:00"
        val dias = (sede?.dias ?: setOf(1, 2, 3, 4, 5)).toMutableSet()

        /** Lo que se ve debajo de los horarios: cómo queda el lugar o, si falta algo, qué es. */
        fun problema(): String? = when {
            dias.isEmpty() -> "Elegí al menos un día de atención."
            cierre <= apertura -> "El horario de cierre tiene que ser posterior al de apertura."
            else -> null
        }

        fun actualizarResumen() {
            val error = problema()
            resumen.text = error ?: ("Atiende " + SedeVet("", "", dias = dias.toSet(), apertura = apertura, cierre = cierre)
                .textoHorario())
            resumen.setTextColor(
                ContextCompat.getColor(activity, if (error == null) R.color.teal_dark else R.color.danger_red)
            )
        }

        val chips = PerfilVetRepo.todosLosDias.mapIndexed { i, dia ->
            (activity.layoutInflater.inflate(R.layout.view_chip_registro, grupoDias, false) as Chip).also { chip ->
                chip.text = dia.take(3)
                chip.isChecked = (i + 1) in dias
                chip.setOnCheckedChangeListener { _, marcado ->
                    if (marcado) dias.add(i + 1) else dias.remove(i + 1)
                    actualizarResumen()
                }
                grupoDias.addView(chip)
            }
        }
        fun aplicarDias(cantidad: Int) = chips.forEachIndexed { i, chip -> chip.isChecked = i < cantidad }
        vista.findViewById<View>(R.id.btnSedePresetLV).setOnClickListener { aplicarDias(5) }
        vista.findViewById<View>(R.id.btnSedePresetLS).setOnClickListener { aplicarDias(6) }

        fun elegirHora(actual: String, alElegir: (String) -> Unit) {
            val h = actual.substringBefore(":").toIntOrNull() ?: 9
            val m = actual.substringAfter(":").toIntOrNull() ?: 0
            TimePickerDialog(activity, { _, hh, mm -> alElegir("%02d:%02d".format(hh, mm)) }, h, m, true).show()
        }
        etApertura.setText("$apertura hs")
        etCierre.setText("$cierre hs")
        etApertura.setOnClickListener {
            elegirHora(apertura) { apertura = it; etApertura.setText("$it hs"); actualizarResumen() }
        }
        etCierre.setOnClickListener {
            elegirHora(cierre) { cierre = it; etCierre.setText("$it hs"); actualizarResumen() }
        }
        actualizarResumen()

        vista.findViewById<MaterialButton>(R.id.btnSedeGuardar).setOnClickListener {
            val nuevo = SedeVet(
                id = sede?.id.orEmpty(), nombre = etNombre.text.toString().trim(),
                direccion = etDireccion.text.toString().trim(), dias = dias.toSet(), apertura = apertura, cierre = cierre
            )
            if (nuevo.nombre.isBlank()) {
                etNombre.error = "Ingresá el nombre de la veterinaria"
                etNombre.requestFocus()
                return@setOnClickListener
            }
            if (problema() != null) return@setOnClickListener
            alGuardar(nuevo)
            hoja.dismiss()
        }
        vista.findViewById<View>(R.id.btnSedeCancelar).setOnClickListener { hoja.dismiss() }
        vista.findViewById<MaterialButton>(R.id.btnSedeEliminar).apply {
            if (alEliminar != null) {
                visibility = View.VISIBLE
                setOnClickListener { alEliminar(hoja) }
            }
        }
        hoja.show()
    }

    /** Dirección y, debajo, los días y el horario; el texto que se muestra en las listas. */
    fun detalle(sede: SedeVet): String =
        listOf(sede.direccion, sede.textoHorario()).filter { it.isNotBlank() }.joinToString("\n")
}
