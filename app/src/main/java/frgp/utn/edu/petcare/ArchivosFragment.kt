package frgp.utn.edu.petcare

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton
import java.io.File

class ArchivosFragment : Fragment() {

    private lateinit var rvArchivos: RecyclerView
    private var archivosActuales = listOf<ArchivoItem>()

    private val pickFileLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { selectedUri ->
            val fileName = getFileName(selectedUri) ?: "Documento"
            val extension = getExtension(fileName)
            val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)

            // Guardar copia local permanente en el almacenamiento interno de la app
            val localFile = copyFileToInternalStorage(selectedUri, fileName, paciente.id)
            val localPath = localFile?.absolutePath

            ArchivosRepo.agregar(paciente.id, fileName, extension, selectedUri.toString(), localPath)
            refrescar()
            Toast.makeText(requireContext(), "Archivo '$fileName' subido correctamente", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_archivos, container, false)
        rvArchivos = view.findViewById(R.id.rvArchivos)

        view.findViewById<ExtendedFloatingActionButton>(R.id.fabSubirArchivo)?.setOnClickListener {
            pickFileLauncher.launch("*/*")
        }

        refrescar()
        return view
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
            vacio.findViewById<android.widget.TextView>(R.id.tvEmptyMessage).text = "Subí estudios, recetas o documentos del paciente"
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

    private fun verArchivo(item: ArchivoItem) {
        val context = requireContext()
        val mimeType = getMimeType(item.tipoExtension)

        // 1. Intentar abrir con el archivo guardado localmente mediante FileProvider
        if (!item.localPath.isNullOrEmpty()) {
            val file = File(item.localPath)
            if (file.exists()) {
                try {
                    val contentUri = FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        file
                    )
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(contentUri, mimeType)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(intent)
                    return
                } catch (e: Exception) {
                    // Fallback si no hay visor externo
                }
            }
        }

        // 2. Intentar abrir con la URI original si está presente
        if (!item.uriString.isNullOrEmpty()) {
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(Uri.parse(item.uriString), mimeType)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(intent)
                return
            } catch (e: Exception) {
                // Fallback a diálogo visor
            }
        }

        // 3. Fallback: Diálogo visor integrado
        mostrarDialogoVisualizador(item)
    }

    private fun mostrarDialogoVisualizador(item: ArchivoItem) {
        AlertDialog.Builder(requireContext())
            .setTitle(item.nombre)
            .setMessage("Detalle: ${item.fecha}\nTipo de archivo: ${item.tipoExtension}\n\nDocumento guardado y listo para previsualización.")
            .setPositiveButton("Aceptar", null)
            .show()
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
                    ArchivosRepo.renombrar(item.id, nuevoNombre)
                    refrescar()
                    Toast.makeText(requireContext(), "Nombre actualizado", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(requireContext(), "El nombre no puede estar vacío", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun eliminarArchivo(item: ArchivoItem) {
        AlertDialog.Builder(requireContext())
            .setTitle("Eliminar archivo")
            .setMessage("¿Querés eliminar '${item.nombre}'?")
            .setPositiveButton("Eliminar") { _, _ ->
                item.localPath?.let { path ->
                    try { File(path).delete() } catch (e: Exception) { }
                }
                ArchivosRepo.eliminar(item.id)
                refrescar()
                Toast.makeText(requireContext(), "Archivo eliminado", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun copyFileToInternalStorage(uri: Uri, fileName: String, pacienteId: Int): File? {
        return try {
            val destFile = File(requireContext().filesDir, "doc_${pacienteId}_${System.currentTimeMillis()}_$fileName")
            requireContext().contentResolver.openInputStream(uri)?.use { input ->
                destFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
            destFile
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun getFileName(uri: Uri): String? {
        var result: String? = null
        if (uri.scheme == "content") {
            val cursor = requireContext().contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) {
                        result = it.getString(index)
                    }
                }
            }
        }
        if (result == null) {
            result = uri.path
            val cut = result?.lastIndexOf('/') ?: -1
            if (cut != -1) {
                result = result?.substring(cut + 1)
            }
        }
        return result
    }

    private fun getExtension(fileName: String): String {
        val dot = fileName.lastIndexOf('.')
        return if (dot >= 0 && dot < fileName.length - 1) {
            fileName.substring(dot + 1).uppercase()
        } else {
            "DOC"
        }
    }

    private fun getMimeType(ext: String): String {
        return when (ext.uppercase()) {
            "PDF" -> "application/pdf"
            "DOC", "DOCX" -> "application/msword"
            "JPG", "JPEG" -> "image/jpeg"
            "PNG" -> "image/png"
            "TXT" -> "text/plain"
            else -> "*/*"
        }
    }
}
