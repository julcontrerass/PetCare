package frgp.utn.edu.petcare

import android.app.DatePickerDialog
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.AdapterView
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout
import java.util.Calendar
import java.util.Locale

/** Vacunas, tratamientos y documentos de las mascotas, con búsqueda y filtro por mascota. */
class CarnetSaludActivity : AppCompatActivity() {

    private val tipos = TipoRegistro.values()
    private lateinit var adapter: RegistrosAdapter
    private lateinit var etBuscar: EditText
    private lateinit var spMascota: Spinner
    private lateinit var tabLayout: TabLayout
    private lateinit var tvVacio: TextView

    private var pendienteDocumento: ((Uri, String) -> Unit)? = null
    private val pickDocumento = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) pendienteDocumento?.invoke(uri, nombreArchivo(uri))
        pendienteDocumento = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.carnet_salud)

        findViewById<Toolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }
        etBuscar = findViewById(R.id.etBuscarRegistro)
        spMascota = findViewById(R.id.spMascotaFiltro)
        tabLayout = findViewById(R.id.tabLayoutSalud)
        tvVacio = findViewById(R.id.tvVacio)

        spMascota.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item,
            listOf("Todas las mascotas") + SaludRepo.mascotas
        )
        tipos.forEach { tabLayout.addTab(tabLayout.newTab().setText(it.etiqueta)) }

        adapter = RegistrosAdapter(emptyList()) { confirmarEliminar(it) }
        findViewById<RecyclerView>(R.id.rvRegistros).adapter = adapter

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) = refrescar()
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
        spMascota.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) = refrescar()
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
        etBuscar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) = refrescar()
            override fun afterTextChanged(s: Editable?) {}
        })
        findViewById<ImageButton>(R.id.btnAgregarRegistro).setOnClickListener { mostrarDialogoAgregar() }

        refrescar()
    }

    private fun tipoActual(): TipoRegistro = tipos[tabLayout.selectedTabPosition.coerceAtLeast(0)]

    private fun refrescar() {
        val mascota = if (spMascota.selectedItemPosition > 0) SaludRepo.mascotas[spMascota.selectedItemPosition - 1] else null
        val lista = SaludRepo.filtrar(tipoActual(), etBuscar.text.toString(), mascota)
        adapter.update(lista)
        tvVacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun confirmarEliminar(r: RegistroSalud) {
        AlertDialog.Builder(this)
            .setTitle("Eliminar registro")
            .setMessage("¿Eliminar \"${r.titulo}\"?")
            .setPositiveButton("Eliminar") { _, _ ->
                SaludRepo.registros.remove(r)
                refrescar()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun nombreArchivo(uri: Uri): String {
        contentResolver.query(uri, null, null, null, null)?.use { c ->
            val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (i >= 0 && c.moveToFirst()) return c.getString(i)
        }
        return uri.lastPathSegment ?: "Documento"
    }

    private fun campo(hint: String): EditText = EditText(this).apply {
        this.hint = hint
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(0, 12, 0, 12) }
    }

    private fun campoFecha(hint: String): EditText = campo(hint).apply {
        isFocusable = false
        setOnClickListener {
            val c = Calendar.getInstance()
            DatePickerDialog(this@CarnetSaludActivity, { _, y, m, d ->
                val meses = arrayOf("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")
                setText(String.format(Locale.getDefault(), "%02d %s %d", d, meses[m], y))
            }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show()
        }
    }

    private fun mostrarDialogoAgregar() {
        val tipo = tipoActual()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 8)
        }
        val spinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@CarnetSaludActivity, android.R.layout.simple_spinner_dropdown_item, SaludRepo.mascotas
            )
            if (spMascota.selectedItemPosition > 0) setSelection(spMascota.selectedItemPosition - 1)
        }
        layout.addView(spinner)

        val etTitulo = campo(
            when (tipo) {
                TipoRegistro.VACUNA -> "Vacuna (ej: Antirrábica)"
                TipoRegistro.TRATAMIENTO -> "Medicamento / tratamiento"
                TipoRegistro.DOCUMENTO -> "Nombre del documento"
            }
        )
        layout.addView(etTitulo)

        val etFecha = campoFecha(if (tipo == TipoRegistro.TRATAMIENTO) "Fecha de inicio" else "Fecha")
        val etExtra = when (tipo) {
            TipoRegistro.VACUNA -> campoFecha("Próxima dosis (opcional)")
            TipoRegistro.TRATAMIENTO -> campo("Dosis / indicaciones")
            TipoRegistro.DOCUMENTO -> null
        }
        var archivo: Uri? = null
        var nombreSeleccionado: String? = null
        val tvArchivo = TextView(this).apply { text = "Ningún archivo seleccionado" }

        layout.addView(etFecha)
        etExtra?.let { layout.addView(it) }
        if (tipo == TipoRegistro.DOCUMENTO) {
            layout.addView(android.widget.Button(this).apply {
                text = "Seleccionar archivo"
                setOnClickListener {
                    pendienteDocumento = { uri, nombre ->
                        archivo = uri
                        nombreSeleccionado = nombre
                        tvArchivo.text = nombre
                        if (etTitulo.text.isBlank()) etTitulo.setText(nombre)
                    }
                    pickDocumento.launch("*/*")
                }
            })
            layout.addView(tvArchivo)
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle("Agregar ${tipo.etiqueta.lowercase().removeSuffix("s")}")
            .setView(android.widget.ScrollView(this).apply { addView(layout) })
            .setPositiveButton("Guardar", null)
            .setNegativeButton("Cancelar", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val titulo = etTitulo.text.toString().trim()
                val fecha = etFecha.text.toString().trim()
                if (titulo.isEmpty()) { etTitulo.error = "Requerido"; return@setOnClickListener }
                if (tipo != TipoRegistro.DOCUMENTO && fecha.isEmpty()) { etFecha.error = "Requerido"; return@setOnClickListener }
                if (tipo == TipoRegistro.DOCUMENTO && archivo == null) {
                    Toast.makeText(this, "Seleccioná un archivo", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                val extra = etExtra?.text?.toString()?.trim().orEmpty()
                val registro = when (tipo) {
                    TipoRegistro.VACUNA -> RegistroSalud(
                        tipo, spinner.selectedItem as String, titulo,
                        if (extra.isEmpty()) "Sin próxima dosis" else "Próxima dosis: $extra", fecha, "Al día"
                    )
                    TipoRegistro.TRATAMIENTO -> RegistroSalud(
                        tipo, spinner.selectedItem as String, titulo,
                        extra.ifEmpty { "Sin indicaciones" }, "Desde $fecha", "Activo"
                    )
                    TipoRegistro.DOCUMENTO -> RegistroSalud(
                        tipo, spinner.selectedItem as String, titulo,
                        nombreSeleccionado ?: "Documento",
                        fecha.ifEmpty { "Hoy" }, null, archivo.toString()
                    )
                }
                SaludRepo.registros.add(0, registro)
                refrescar()
                dialog.dismiss()
            }
        }
        dialog.show()
    }
}

class RegistrosAdapter(
    private var items: List<RegistroSalud>,
    private val onLongClick: (RegistroSalud) -> Unit
) : RecyclerView.Adapter<RegistrosAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvTitulo: TextView = view.findViewById(R.id.tvTitulo)
        val tvEstado: TextView = view.findViewById(R.id.tvEstado)
        val tvMascotaFecha: TextView = view.findViewById(R.id.tvMascotaFecha)
        val tvDetalle: TextView = view.findViewById(R.id.tvDetalle)
    }

    fun update(nuevos: List<RegistroSalud>) {
        items = nuevos
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_registro_salud, parent, false))

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val r = items[position]
        val ctx = holder.itemView.context
        holder.tvTitulo.text = r.titulo
        holder.tvMascotaFecha.text = "${r.mascota} · ${r.fecha}"
        holder.tvDetalle.text = r.detalle

        if (r.estado == null) {
            holder.tvEstado.visibility = View.GONE
        } else {
            holder.tvEstado.visibility = View.VISIBLE
            holder.tvEstado.text = r.estado
            val (fondo, texto) = when (r.estado) {
                "Vencida" -> R.drawable.bg_badge_red to R.color.danger_red
                "Próxima" -> R.drawable.bg_badge_orange to R.color.accent_orange
                "Finalizado" -> R.drawable.bg_badge_orange to R.color.text_gray
                else -> R.drawable.bg_badge_green to R.color.success_green
            }
            holder.tvEstado.setBackgroundResource(fondo)
            holder.tvEstado.setTextColor(ContextCompat.getColor(ctx, texto))
        }
        holder.itemView.setOnLongClickListener { onLongClick(r); true }
    }

    override fun getItemCount() = items.size
}
