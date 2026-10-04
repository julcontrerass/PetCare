package frgp.utn.edu.petcare

enum class TipoRegistro(val etiqueta: String) {
    VACUNA("Vacunas"),
    TRATAMIENTO("Tratamientos"),
    DOCUMENTO("Documentos")
}

data class RegistroSalud(
    val tipo: TipoRegistro,
    val mascota: String,
    val titulo: String,
    val detalle: String,
    val fecha: String,
    val estado: String? = null,
    val archivoUri: String? = null
)

/** Datos de demostración en memoria hasta que exista el backend. */
object SaludRepo {

    val mascotas = listOf("Koda", "Mika", "Luna", "Milo")

    val registros: MutableList<RegistroSalud> = mutableListOf(
        RegistroSalud(TipoRegistro.VACUNA, "Koda", "Antirrábica", "Próxima dosis: 10 May 2027", "10 May 2026", "Al día"),
        RegistroSalud(TipoRegistro.VACUNA, "Koda", "Séxtuple", "Próxima dosis: 15 Ago 2026", "15 Ago 2025", "Próxima"),
        RegistroSalud(TipoRegistro.VACUNA, "Luna", "Antirrábica", "Próxima dosis: 18 May 2027", "18 May 2026", "Al día"),
        RegistroSalud(TipoRegistro.VACUNA, "Mika", "Triple felina", "Próxima dosis: 02 Mar 2026", "02 Mar 2025", "Vencida"),
        RegistroSalud(TipoRegistro.TRATAMIENTO, "Milo", "Levotiroxina", "0.1 mg cada 12 hs", "Desde 12 Ene 2026", "Activo"),
        RegistroSalud(TipoRegistro.TRATAMIENTO, "Koda", "Antiinflamatorio", "1 comprimido por día por 7 días", "01 Abr 2026 - 08 Abr 2026", "Finalizado"),
        RegistroSalud(TipoRegistro.DOCUMENTO, "Koda", "Resultados de análisis de sangre", "PDF", "25 Abr 2026"),
        RegistroSalud(TipoRegistro.DOCUMENTO, "Luna", "Certificado de vacunación", "PDF", "18 May 2026")
    )

    fun filtrar(tipo: TipoRegistro, consulta: String, mascota: String?): List<RegistroSalud> {
        val q = consulta.trim().lowercase()
        return registros.filter { r ->
            r.tipo == tipo &&
                (mascota == null || r.mascota == mascota) &&
                (q.isEmpty() ||
                    r.titulo.lowercase().contains(q) ||
                    r.detalle.lowercase().contains(q) ||
                    r.mascota.lowercase().contains(q))
        }
    }
}
