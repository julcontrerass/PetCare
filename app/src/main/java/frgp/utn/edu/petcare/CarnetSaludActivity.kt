package frgp.utn.edu.petcare

import android.app.DatePickerDialog
import frgp.utn.edu.petcare.ui.common.ArchivosUi
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.ui.common.Avisos
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
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Servicios
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.util.Calendar
import java.util.UUID
import java.util.Locale

/** Vacunas, tratamientos y documentos de las mascotas, con búsqueda y filtro por mascota. */
class CarnetSaludActivity : BaseActivity() {

    companion object {
        private const val TAMANO_MAXIMO = 15L * 1024 * 1024
        private val EXTENSIONES = mapOf(
            "PDF" to "application/pdf",
            "JPG" to "image/jpeg",
            "JPEG" to "image/jpeg",
            "PNG" to "image/png",
            "WEBP" to "image/webp",
            "DOC" to "application/msword",
            "DOCX" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    }

    private val tipos = TipoRegistro.entries
    private lateinit var adapter: RegistrosAdapter
    private lateinit var etBuscar: EditText
    private var mascotaFiltro: String? = null
    private lateinit var tabLayout: TabLayout
    private lateinit var vacio: View

    private var pendienteDocumento: ((Uri, String) -> Unit)? = null
    private val pickDocumento = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) pendienteDocumento?.invoke(uri, nombreArchivo(uri))
        pendienteDocumento = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        setContentView(R.layout.carnet_salud)
        androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = true

        findViewById<View>(R.id.btnBack).setOnClickListener { finish() }
        etBuscar = findViewById(R.id.etBuscarRegistro)
        tabLayout = findViewById(R.id.tabLayoutSalud)
        vacio = findViewById(R.id.emptyRegistros)

        construirFiltroMascotas()
        // El carnet del dueño no se carga al ingresar: se pide al abrir la pantalla
        if (Sesion.rol == Sesion.Rol.DUENO) {
            lifecycleScope.launch {
                runCatching { SaludRepo.cargarComoDueno() }.onFailure { Avisos.error(this@CarnetSaludActivity, Errores.mensaje(it)) }
                refrescar()
            }
        }
        tipos.forEach { tabLayout.addTab(tabLayout.newTab().setText(it.etiqueta)) }

        adapter = RegistrosAdapter(emptyList(), { abrirDocumento(it) }) { confirmarEliminar(it) }
        findViewById<RecyclerView>(R.id.rvRegistros).adapter = adapter

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) = refrescar()
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
        etBuscar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) = refrescar()
            override fun afterTextChanged(s: Editable?) {}
        })
        findViewById<View>(R.id.btnAgregarRegistro).setOnClickListener { mostrarDialogoAgregar() }

        refrescar()
    }

    private class MascotaCarnet(val id: String, val nombre: String)

    /** Las mascotas del carnet: las del dueño en sesión o los pacientes del veterinario. */
    private fun mascotasDelCarnet(): List<MascotaCarnet> =
        if (Sesion.rol == Sesion.Rol.DUENO) DuenoRepo.mascotas.map { MascotaCarnet(it.id, it.nombre) }
        else PacientesRepo.pacientes.map { MascotaCarnet(it.id, it.nombre) }

    private fun abrirDocumento(r: RegistroSalud) {
        val ruta = r.archivoPath ?: return
        lifecycleScope.launch {
            ArchivosUi.abrir(this@CarnetSaludActivity, "archivos", ruta, r.detalle.substringAfterLast('.', r.detalle.substringBefore(' ')))
        }
    }

    private fun tipoActual(): TipoRegistro = tipos[tabLayout.selectedTabPosition.coerceAtLeast(0)]

    private fun dp(valor: Int) = (valor * resources.displayMetrics.density).toInt()

    private fun construirFiltroMascotas() {
        val fila = findViewById<LinearLayout>(R.id.llFiltroMascotas)
        fila.removeAllViews()
        (listOf<MascotaCarnet?>(null) + mascotasDelCarnet()).forEach { paciente ->
            val chip = TextView(this).apply {
                text = paciente?.nombre ?: "Todas"
                tag = paciente?.id
                textSize = 14f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setPadding(dp(18), dp(9), dp(18), dp(9))
                elevation = dp(1).toFloat()
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { marginEnd = dp(10) }
                setOnClickListener {
                    mascotaFiltro = paciente?.id
                    refrescar()
                }
            }
            fila.addView(chip)
        }
    }

    private fun estiloFiltroMascotas() {
        val fila = findViewById<LinearLayout>(R.id.llFiltroMascotas)
        for (i in 0 until fila.childCount) {
            val chip = fila.getChildAt(i) as TextView
            val activo = chip.tag == mascotaFiltro
            chip.setBackgroundResource(if (activo) R.drawable.bg_pill_teal else R.drawable.bg_pill_white)
            chip.setTextColor(ContextCompat.getColor(this, if (activo) R.color.white else R.color.text_gray))
        }
    }

    private fun actualizarResumen() {
        val vacunas = SaludRepo.registros.filter { it.tipo == TipoRegistro.VACUNA }
        findViewById<TextView>(R.id.tvStatAlDia).text = vacunas.count { it.estado == "Al día" }.toString()
        findViewById<TextView>(R.id.tvStatPendientes).text =
            vacunas.count { it.estado == "Próxima" || it.estado == "Vencida" }.toString()
        findViewById<TextView>(R.id.tvStatDocs).text =
            SaludRepo.registros.count { it.tipo == TipoRegistro.DOCUMENTO }.toString()
    }

    private fun refrescar() {
        val lista = SaludRepo.filtrar(tipoActual(), etBuscar.text.toString(), mascotaFiltro)
        adapter.update(lista)
        actualizarResumen()
        estiloFiltroMascotas()

        vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
        findViewById<RecyclerView>(R.id.rvRegistros).visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        val icono = when (tipoActual()) {
            TipoRegistro.VACUNA -> R.drawable.ic_syringe
            TipoRegistro.TRATAMIENTO -> R.drawable.ic_pulse
            TipoRegistro.DOCUMENTO -> R.drawable.ic_document
        }
        vacio.findViewById<android.widget.ImageView>(R.id.ivEmptyIcon).setImageResource(icono)
        vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = "No hay ${tipoActual().etiqueta.lowercase()} para mostrar"
        vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = "Tocá + para agregar uno"
    }

    private fun confirmarEliminar(r: RegistroSalud) {
        Avisos.confirmar(
            this, "¿Eliminar el registro?", "Se borra \"${r.titulo}\" del carnet. No se puede deshacer.",
            textoAceptar = "Eliminar", textoCancelar = "Cancelar"
        ) {
            SaludRepo.eliminar(r)
            refrescar()
        }
    }

    /** Sube el documento al bucket `archivos` y recién entonces lo suma al carnet. */
    private fun subirDocumento(mascotaId: String, titulo: String, nombre: String, uri: Uri, fecha: LocalDate) {
        val extension = nombre.substringAfterLast('.', "").lowercase()
        val mime = EXTENSIONES[extension.uppercase()]
        if (mime == null) {
            Avisos.mostrar(this, "Formato no admitido. Subí un PDF, una imagen o un documento de Word.")
            return
        }
        lifecycleScope.launch {
            try {
                val bytes = withContext(Dispatchers.IO) { contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                    ?: throw IllegalStateException("No se pudo leer el archivo")
                if (bytes.size > TAMANO_MAXIMO) {
                    Avisos.mostrar(this@CarnetSaludActivity, "El archivo supera los 15 MB")
                    return@launch
                }
                val ruta = "$mascotaId/${UUID.randomUUID()}.$extension"
                Servicios.fuente.subir(ArchivosRepo.BUCKET, ruta, bytes, mime)
                SaludRepo.agregar(TipoRegistro.DOCUMENTO, mascotaId, titulo, nombre, fecha, archivoPath = ruta)
                refrescar()
            } catch (e: Exception) {
                Avisos.error(this@CarnetSaludActivity, Errores.mensaje(e))
            }
        }
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
                this@CarnetSaludActivity, android.R.layout.simple_spinner_dropdown_item,
                mascotasDelCarnet().map { it.nombre }
            )
            mascotaFiltro?.let { id -> setSelection(mascotasDelCarnet().indexOfFirst { it.id == id }.coerceAtLeast(0)) }
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
                    Avisos.mostrar(this, "Seleccioná un archivo")
                    return@setOnClickListener
                }
                val extra = etExtra?.text?.toString()?.trim().orEmpty()
                val paciente = mascotasDelCarnet().getOrNull(spinner.selectedItemPosition)
                if (paciente == null) {
                    Avisos.mostrar(this, "Elegí una mascota")
                    return@setOnClickListener
                }
                val fechaElegida = Fechas.parsear(fecha) ?: LocalDate.now()
                when (tipo) {
                    TipoRegistro.VACUNA -> SaludRepo.agregar(
                        tipo, paciente.id, titulo, null, fechaElegida, proximaDosis = Fechas.parsear(extra)
                    )
                    TipoRegistro.TRATAMIENTO -> SaludRepo.agregar(
                        tipo, paciente.id, titulo, extra.ifEmpty { "Sin indicaciones" }, fechaElegida
                    )
                    TipoRegistro.DOCUMENTO -> subirDocumento(
                        paciente.id, titulo, nombreSeleccionado ?: "Documento", archivo!!, fechaElegida
                    )
                }
                refrescar()
                dialog.dismiss()
            }
        }
        dialog.show()
    }
}

class RegistrosAdapter(
    private var items: List<RegistroSalud>,
    private val onClick: (RegistroSalud) -> Unit,
    private val onLongClick: (RegistroSalud) -> Unit
) : RecyclerView.Adapter<RegistrosAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val flIcono: View = view.findViewById(R.id.flIcono)
        val ivIcono: android.widget.ImageView = view.findViewById(R.id.ivIcono)
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
                "Vencida" -> R.drawable.bg_chip_danger to R.color.danger_red
                "Próxima" -> R.drawable.bg_chip_warn to R.color.accent_orange_dark
                "Finalizado" -> R.drawable.bg_chip_neutral to R.color.text_gray
                else -> R.drawable.bg_chip_ok to R.color.success_green
            }
            holder.tvEstado.setBackgroundResource(fondo)
            holder.tvEstado.setTextColor(ContextCompat.getColor(ctx, texto))
        }
        val (icono, fondoIcono, colorIcono) = when (r.tipo) {
            TipoRegistro.VACUNA -> Triple(R.drawable.ic_syringe, R.color.light_green, R.color.success_green)
            TipoRegistro.TRATAMIENTO -> Triple(R.drawable.ic_pulse, R.color.light_purple, R.color.accent_purple)
            TipoRegistro.DOCUMENTO -> Triple(R.drawable.ic_document, R.color.light_orange, R.color.accent_orange)
        }
        holder.ivIcono.setImageResource(icono)
        holder.ivIcono.setColorFilter(ContextCompat.getColor(ctx, colorIcono))
        holder.flIcono.backgroundTintList = ContextCompat.getColorStateList(ctx, fondoIcono)
        holder.itemView.setOnClickListener { if (r.archivoPath != null) onClick(r) }
        holder.itemView.setOnLongClickListener { onLongClick(r); true }
    }

    override fun getItemCount() = items.size
}
