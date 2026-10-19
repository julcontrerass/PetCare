package frgp.utn.edu.petcare.ui.common

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.repositorio.RecordatorioManual
import frgp.utn.edu.petcare.data.repositorio.RecordatoriosRepo
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate

/** Formulario para crear o editar un recordatorio, el mismo para el dueño y para el veterinario. */
object EditorRecordatorio {

    /**
     * [mascotas] son los (id, nombre) entre los que se puede elegir; si es una sola o se edita uno existente, no se
     * pregunta. [alGuardar] se llama cuando ya se guardó, para que la pantalla se dibuje de nuevo.
     */
    fun mostrar(
        host: AppCompatActivity,
        mascotas: List<Pair<String, String>>,
        existente: RecordatorioManual? = null,
        alGuardar: () -> Unit
    ) {
        if (existente == null && mascotas.isEmpty()) {
            Avisos.mostrar(host, "Primero necesitás una mascota para crear un recordatorio")
            return
        }
        val dp = { v: Int -> (v * host.resources.displayMetrics.density).toInt() }
        val gris = ContextCompat.getColor(host, R.color.text_gray)

        val contenido = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(4))
        }
        fun etiqueta(texto: String) = TextView(host).apply {
            text = texto
            textSize = 12f
            setTextColor(gris)
            setPadding(0, dp(12), 0, dp(2))
        }

        // Mascota (solo al crear y si hay para elegir)
        var mascotaElegida = existente?.mascotaId ?: mascotas.firstOrNull()?.first
        if (existente == null && mascotas.size > 1) {
            contenido.addView(etiqueta("Mascota"))
            contenido.addView(Spinner(host).apply {
                adapter = ArrayAdapter(host, android.R.layout.simple_spinner_dropdown_item, mascotas.map { it.second })
                onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(p: android.widget.AdapterView<*>?, v: View?, i: Int, id: Long) {
                        mascotaElegida = mascotas[i].first
                    }
                    override fun onNothingSelected(p: android.widget.AdapterView<*>?) {}
                }
            })
        }

        contenido.addView(etiqueta("Qué querés recordar"))
        val titulo = EditText(host).apply {
            hint = "Ej.: Bañar a la mascota"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            maxLines = 1
            setText(existente?.titulo.orEmpty())
        }
        contenido.addView(titulo)

        contenido.addView(etiqueta("Tipo"))
        val tipos = RecordatoriosRepo.TIPOS
        val tipo = Spinner(host).apply {
            adapter = ArrayAdapter(host, android.R.layout.simple_spinner_dropdown_item, tipos)
            setSelection(tipos.indexOf(existente?.tipo).coerceAtLeast(0))
        }
        contenido.addView(tipo)

        // Fecha y hora
        var fecha = existente?.fecha ?: LocalDate.now()
        var hora: String? = existente?.hora
        contenido.addView(etiqueta("Cuándo"))
        val fila = LinearLayout(host).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val botonFecha = TextView(host)
        val botonHora = TextView(host)
        fun pintar() {
            botonFecha.text = Fechas.corta(fecha)
            botonHora.text = hora?.let { "$it hs" } ?: "Sin hora"
        }
        listOf(botonFecha, botonHora).forEach {
            it.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = dp(8) }
            it.gravity = Gravity.CENTER
            it.textSize = 14f
            it.setPadding(dp(8), dp(11), dp(8), dp(11))
            it.setBackgroundResource(R.drawable.bg_pill_white)
            it.setTextColor(ContextCompat.getColor(host, R.color.brand_navy))
            fila.addView(it)
        }
        botonFecha.setOnClickListener {
            DatePickerDialog(host, { _, a, m, d -> fecha = LocalDate.of(a, m + 1, d); pintar() },
                fecha.year, fecha.monthValue - 1, fecha.dayOfMonth).show()
        }
        botonHora.setOnClickListener {
            val (h, m) = (hora ?: "09:00").split(":").map { it.toInt() }
            TimePickerDialog(host, { _, hh, mm -> hora = "%02d:%02d".format(hh, mm); pintar() }, h, m, true).apply {
                setButton(TimePickerDialog.BUTTON_NEUTRAL, "Sin hora") { _, _ -> hora = null; pintar() }
            }.show()
        }
        pintar()
        contenido.addView(fila)

        contenido.addView(etiqueta("Nota (opcional)"))
        val nota = EditText(host).apply {
            hint = "Algún detalle para acordarte"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            minLines = 2
            setText(existente?.nota.orEmpty())
        }
        contenido.addView(nota)

        val dialogo = AlertDialog.Builder(host)
            .setTitle(if (existente == null) "Nuevo recordatorio" else "Editar recordatorio")
            .setView(ScrollView(host).apply { addView(contenido) })
            .setPositiveButton("Guardar", null)
            .setNegativeButton(R.string.btn_cancelar, null)
            .create()
        dialogo.show()
        dialogo.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val texto = titulo.text.toString().trim()
            when {
                texto.isEmpty() -> titulo.error = "Escribí qué querés recordar"
                // Se puede dejar una fecha pasada si no se la tocó; lo nuevo no puede ser de antes de hoy
                fecha.isBefore(LocalDate.now()) && (existente == null || fecha != existente.fecha) ->
                    Avisos.mostrar(host, "La fecha no puede ser anterior a hoy")
                else -> {
                    val elegido = tipos[tipo.selectedItemPosition]
                    if (existente == null) {
                        RecordatoriosRepo.crear(mascotaElegida ?: return@setOnClickListener, texto, elegido, fecha, hora, nota.text.toString().trim())
                    } else {
                        RecordatoriosRepo.editar(existente, texto, elegido, fecha, hora, nota.text.toString().trim())
                    }
                    dialogo.dismiss()
                    alGuardar()
                }
            }
        }
    }
}
