package frgp.utn.edu.petcare

data class InformeData(
    val pacienteId: Int,
    var motivo: String = "",
    var diagnostico: String = "",
    var tratamiento: String = ""
)

object InformesRepo {
    private val informes = mutableMapOf<Int, InformeData>()

    fun obtener(pacienteId: Int): InformeData {
        return informes.getOrPut(pacienteId) {
            InformeData(pacienteId = pacienteId)
        }
    }

    fun guardar(pacienteId: Int, motivo: String, diagnostico: String, tratamiento: String) {
        informes[pacienteId] = InformeData(
            pacienteId = pacienteId,
            motivo = motivo,
            diagnostico = diagnostico,
            tratamiento = tratamiento
        )
    }
}
