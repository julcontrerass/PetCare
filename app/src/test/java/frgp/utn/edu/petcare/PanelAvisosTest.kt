package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.ui.common.Insignia
import frgp.utn.edu.petcare.ui.common.PanelAvisos
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class PanelAvisosTest {
    private val hoy = LocalDate.of(2026, 5, 20)

    @Test
    fun grupo_clasificaPorAntiguedad() {
        assertEquals("HOY", PanelAvisos.grupo(hoy, hoy))
        assertEquals("AYER", PanelAvisos.grupo(hoy.minusDays(1), hoy))
        assertEquals("ESTA SEMANA", PanelAvisos.grupo(hoy.minusDays(4), hoy))
        assertEquals("ANTERIORES", PanelAvisos.grupo(hoy.minusDays(20), hoy))
    }

    @Test
    fun resumen_describeElEstado() {
        assertEquals("Estás al día", PanelAvisos.resumen(0, 0))
        assertEquals("Todo leído", PanelAvisos.resumen(3, 0))
        assertEquals("1 sin leer", PanelAvisos.resumen(3, 1))
        assertEquals("4 sin leer", PanelAvisos.resumen(5, 4))
    }

    @Test
    fun insignia_topeaEnNueveMas() {
        assertEquals("3", Insignia.texto(3))
        assertEquals("9", Insignia.texto(9))
        assertEquals("9+", Insignia.texto(10))
    }
}

class ContactoRevisionTest {
    @Test
    fun mensajeDeRevision_aprobadoYRechazado() {
        val ok = frgp.utn.edu.petcare.ui.common.Contacto.mensajeDeRevision("Ana Pérez", true)
        assertEquals(true, ok.startsWith("Hola Ana,") && ok.contains("aprobada"))
        val no = frgp.utn.edu.petcare.ui.common.Contacto.mensajeDeRevision("Ana Pérez", false, "Datos incompletos")
        assertEquals(true, no.contains("no fue aprobada. Motivo: Datos incompletos"))
    }
}
