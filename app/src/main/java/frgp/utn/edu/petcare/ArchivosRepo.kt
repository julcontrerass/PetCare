package frgp.utn.edu.petcare

data class ArchivoItem(
    val id: Int,
    val pacienteId: Int,
    val nombre: String,
    val fecha: String,
    val tipoExtension: String,
    val iconRes: Int,
    val uriString: String? = null,
    val localPath: String? = null
)

object ArchivosRepo {
    private var nextId = 100
    private val lista = mutableListOf(
        ArchivoItem(1, 4, "Receta Médica - Antibióticos", "Subido el 15 May 2026 · PDF", "PDF", R.drawable.ic_pencil),
        ArchivoItem(2, 4, "Análisis de Sangre", "Subido el 10 Feb 2026 · PDF", "PDF", R.drawable.ic_list),
        ArchivoItem(3, 4, "Certificado de Vacunación", "Subido el 20 Ene 2026 · PDF", "PDF", R.drawable.ic_calendar),
        ArchivoItem(4, 1, "Ecografía Abdominal", "Subido el 12 May 2026 · JPG", "JPG", R.drawable.ic_camera),
        ArchivoItem(5, 5, "Radiografía Tórax", "Subido el 30 Abr 2026 · PNG", "PNG", R.drawable.ic_camera)
    )

    fun dePaciente(pacienteId: Int): List<ArchivoItem> {
        return lista.filter { it.pacienteId == pacienteId }
    }

    fun agregar(pacienteId: Int, nombre: String, extension: String, uriString: String? = null, localPath: String? = null): ArchivoItem {
        val extUpper = extension.uppercase()
        val icon = when (extUpper) {
            "PDF" -> R.drawable.ic_list
            "DOC", "DOCX" -> R.drawable.ic_pencil
            "JPG", "JPEG", "PNG" -> R.drawable.ic_camera
            else -> R.drawable.ic_list
        }
        val item = ArchivoItem(
            id = nextId++,
            pacienteId = pacienteId,
            nombre = nombre,
            fecha = "Subido hoy · $extUpper",
            tipoExtension = extUpper,
            iconRes = icon,
            uriString = uriString,
            localPath = localPath
        )
        lista.add(0, item)
        return item
    }

    fun renombrar(id: Int, nuevoNombre: String) {
        val index = lista.indexOfFirst { it.id == id }
        if (index != -1) {
            val item = lista[index]
            lista[index] = item.copy(nombre = nuevoNombre)
        }
    }

    fun eliminar(id: Int) {
        lista.removeAll { it.id == id }
    }
}
