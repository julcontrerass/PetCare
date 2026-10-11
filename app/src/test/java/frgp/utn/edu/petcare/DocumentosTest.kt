package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.model.Prescripcion
import frgp.utn.edu.petcare.ui.common.Documentos
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** Prueba lo que se imprime en los PDF; el dibujo en la hoja usa el motor gráfico de Android. */
class DocumentosTest {

    private val vet = Documentos.Profesional("Dra. Vera", "MP-100", "Clínica Sur", "Av. Siempreviva 742", "1155550000")
    private val paciente = Documentos.DatosPaciente("Rex", "Perro", "Mestizo", "Macho", "6 años", "12 kg", "", "Ana Prueba")
    private val fecha = LocalDate.of(2026, 10, 12)

    @Test
    fun receta_llevaMatriculaPacienteYMedicamentos() {
        val medicamentos = listOf(
            Prescripcion("p1", "m1", "t1", "Amoxicilina", "250 mg", 8, 7, "Con comida"),
            Prescripcion("p2", "m1", "t1", "Meloxicam")
        )

        val plano = Documentos.planoDeReceta(vet, paciente, fecha, medicamentos, "Reposo 3 días")
        val texto = plano.texto()

        assertTrue(texto.contains("RECETA VETERINARIA"))
        assertTrue(texto.contains("Matrícula MP-100"))
        assertTrue(texto.contains("Rex") && texto.contains("Ana Prueba"))
        assertTrue(texto.contains("1. Amoxicilina"))
        assertTrue(texto.contains("250 mg, cada 8 hs, durante 7 días"))
        assertTrue(texto.contains("2. Meloxicam"))
        assertTrue(texto.contains("Reposo 3 días"))
        assertEquals("receta-rex-2026-10-12.pdf", Documentos.nombreDeArchivo(plano))
    }

    @Test
    fun certificadoDeVacunacion_listaLasVacunasConLote() {
        val vacuna = RegistroSalud(
            id = "r1", tipo = TipoRegistro.VACUNA, mascotaId = "m1", mascota = "Rex", titulo = "Antirrábica",
            detalle = "", fecha = "05 Oct 2026", marca = "Nobivac", lote = "A123",
            proximaDosis = LocalDate.of(2027, 10, 5)
        )

        val texto = Documentos.planoDeCertificadoVacunacion(vet, paciente, fecha, listOf(vacuna)).texto()

        assertTrue(texto.contains("CERTIFICADO DE VACUNACIÓN"))
        assertTrue(texto.contains("matrícula MP-100"))
        assertTrue(texto.contains("Antirrábica"))
        assertTrue(texto.contains("Producto: Nobivac") && texto.contains("Lote: A123"))
    }

    @Test
    fun certificadoDeVacunacion_sinVacunasLoDice() {
        val texto = Documentos.planoDeCertificadoVacunacion(vet, paciente, fecha, emptyList()).texto()

        assertTrue(texto.contains("No hay vacunas registradas."))
    }

    @Test
    fun certificadoDeSalud_incluyeLaValidezYLasObservaciones() {
        val texto = Documentos.planoDeCertificadoSalud(vet, paciente, fecha, "Sin hallazgos").texto()

        assertTrue(texto.contains("CERTIFICADO DE SALUD"))
        assertTrue(texto.contains("validez de 10 días"))
        assertTrue(texto.contains("Sin hallazgos"))
        assertFalse(texto.contains("No hay vacunas"))
    }
}
