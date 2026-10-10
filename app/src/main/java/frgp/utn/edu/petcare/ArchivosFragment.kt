package frgp.utn.edu.petcare

import android.content.ActivityNotFoundException
import frgp.utn.edu.petcare.ui.common.ArchivosUi
import frgp.utn.edu.petcare.ui.common.Avisos
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton
import frgp.utn.edu.petcare.data.Errores
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ArchivosFragment : Fragment() {

    companion object {
        /** El servidor acepta archivos de hasta 15 MB. */
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

    private lateinit var rvArchivos: RecyclerView
    private var archivosActuales = listOf<ArchivoItem>()

    private val pickFileLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { subirArchivo(it) }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_archivos, container, false)
        rvArchivos = view.findViewById(R.id.rvArchivos)

        val fab = view.findViewById<ExtendedFloatingActionButton>(R.id.fabSubirArchivo)
        // Durante un turno los archivos se adjuntan desde el informe, para que queden ligados a esa consulta
        val enTurno = requireActivity().intent.getStringExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID) != null
        if (enTurno) fab?.visibility = View.GONE
        fab?.setOnClickListener { pickFileLauncher.launch("*/*") }

        refrescar()
        // La lista de archivos se pide al servidor al abrir la pestaña
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { ArchivosRepo.cargar(paciente.id) }
                .onSuccess { refrescar() }
                .onFailure { Avisos.error(requireContext(), Errores.mensaje(it)) }
        }
        return view
    }

    private fun subirArchivo(uri: Uri) {
        val contexto = requireContext().applicationContext
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)
        val nombre = nombreDe(uri) ?: "Documento"
        val extension = extensionDe(nombre)
        if (extension.uppercase() !in EXTENSIONES) {
            Avisos.mostrar(contexto, "Formato no admitido. Subí un PDF, una imagen o un documento de Word.")
            return
        }
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val bytes = withContext(Dispatchers.IO) {
                    contexto.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                } ?: throw IllegalStateException("No se pudo leer el archivo")
                if (bytes.size > TAMANO_MAXIMO) {
                    Avisos.mostrar(contexto, "El archivo supera los 15 MB")
                    return@launch
                }
                ArchivosRepo.agregar(paciente.id, nombre, extension, bytes, mimeDe(extension))
                refrescar()
                Avisos.mostrar(contexto, "Archivo '$nombre' subido correctamente")
            } catch (e: Exception) {
                Avisos.error(contexto, Errores.mensaje(e))
            }
        }
    }

    private fun refrescar() {
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)
        archivosActuales = ArchivosRepo.dePaciente(paciente.id)

        val itemsResumen = archivosActuales.map {
            ResumenItem(it.nombre, it.fecha, it.iconRes)
        }

        val adapter = ResumenAdapter(itemsResumen)
        adapter.setOnItemClickListener { position ->
            if (position in archivosActuales.indices) {
                opcionesArchivo(archivosActuales[position])
            }
        }
        rvArchivos.adapter = adapter

        val vacio = view?.findViewById<View>(R.id.emptyArchivos)
        if (vacio != null) {
            vacio.visibility = if (archivosActuales.isEmpty()) View.VISIBLE else View.GONE
            vacio.findViewById<android.widget.ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_document)
            vacio.findViewById<android.widget.TextView>(R.id.tvEmptyTitle).text = "Sin archivos"
            vacio.findViewById<android.widget.TextView>(R.id.tvEmptyMessage).text =
                if (requireActivity().intent.getStringExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID) != null)
                    "Adjuntá archivos desde la pestaña Informe para que queden en esta consulta"
                else "Subí estudios, recetas o documentos del paciente"
        }
    }

    private fun opcionesArchivo(item: ArchivoItem) {
        val opciones = arrayOf("Abrir / Visualizar", "Cambiar nombre", "Eliminar archivo")
        AlertDialog.Builder(requireContext())
            .setTitle(item.nombre)
            .setItems(opciones) { _, which ->
                when (which) {
                    0 -> verArchivo(item)
                    1 -> renombrarArchivo(item)
                    2 -> eliminarArchivo(item)
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    /** Baja el archivo del servidor (la primera vez) y lo abre con la aplicación que corresponda. */
    private fun verArchivo(item: ArchivoItem) {
        val context = requireContext()
        viewLifecycleOwner.lifecycleScope.launch {
            ArchivosUi.abrir(context, ArchivosRepo.BUCKET, item.storagePath, item.tipoExtension)
        }
    }

    private fun renombrarArchivo(item: ArchivoItem) {
        val etNombre = EditText(requireContext()).apply {
            setText(item.nombre)
            setSelectAllOnFocus(true)
        }
        val container = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 20, 48, 10)
            addView(etNombre)
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Cambiar nombre del archivo")
            .setView(container)
            .setPositiveButton("Guardar") { _, _ ->
                val nuevoNombre = etNombre.text.toString().trim()
                if (nuevoNombre.isNotBlank()) {
                    ArchivosRepo.renombrar(item, nuevoNombre)
                    refrescar()
                    Avisos.mostrar(requireContext(), "Nombre actualizado")
                } else {
                    Avisos.mostrar(requireContext(), "El nombre no puede estar vacío")
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun eliminarArchivo(item: ArchivoItem) {
        Avisos.confirmar(
            requireContext(), "¿Eliminar el archivo?", "Se borra '${item.nombre}' de la ficha. No se puede deshacer.",
            textoAceptar = "Eliminar", textoCancelar = "Cancelar"
        ) {
            ArchivosRepo.eliminar(item)
            refrescar()
            Avisos.mostrar(requireContext(), "Archivo eliminado")
        }
    }

    private fun nombreDe(uri: Uri): String? {
        var resultado: String? = null
        if (uri.scheme == "content") {
            requireContext().contentResolver.query(uri, null, null, null, null)?.use {
                if (it.moveToFirst()) {
                    val indice = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (indice >= 0) resultado = it.getString(indice)
                }
            }
        }
        return resultado ?: uri.path?.substringAfterLast('/')
    }

    private fun extensionDe(nombre: String): String {
        val punto = nombre.lastIndexOf('.')
        return if (punto >= 0 && punto < nombre.length - 1) nombre.substring(punto + 1).lowercase() else "doc"
    }

    private fun mimeDe(extension: String): String = EXTENSIONES[extension.uppercase()] ?: "application/octet-stream"
}
