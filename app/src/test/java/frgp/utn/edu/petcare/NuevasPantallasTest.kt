package frgp.utn.edu.petcare

import android.app.Activity
import android.content.Intent
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.InformeDto
import frgp.utn.edu.petcare.data.remoto.RecordatorioDto
import frgp.utn.edu.petcare.ui.dueno.DuenoActivity
import frgp.utn.edu.petcare.ui.veterinario.DetalleEventoVetActivity
import frgp.utn.edu.petcare.ui.veterinario.DetallePacienteActivity
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.robolectric.Robolectric
import org.robolectric.shadows.ShadowLooper

/** Las pantallas con estado de mascota, permisos con vencimiento, informe cerrado y recordatorios hechos a mano. */
class NuevasPantallasTest : PruebaBase() {

    private val hoy = LocalDate.now()

    private fun <T : Activity> abrir(clase: Class<T>, intent: Intent? = null): T =
        (if (intent == null) Robolectric.buildActivity(clase) else Robolectric.buildActivity(clase, intent)).setup().get()

    private fun texto(a: Activity, id: Int) = a.findViewById<TextView>(id).text.toString()

    @Before
    fun cargarEscenario() {
        fuente.perfiles.add(Escenario.dueno())
        fuente.perfiles.add(Escenario.veterinario())
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.mascotas.add(Escenario.mascota("m2", "Mia", tipo = "Gato").copy(estado = "fallecida"))
    }

    private fun abrirDueno(): DuenoActivity {
        ingresarComoDueno()
        return abrir(DuenoActivity::class.java)
    }

    @Test
    fun dueno_laListaOcultaLasHistoricasYLasMuestraEnSuSolapa() {
        val a = abrirDueno()
        a.findViewById<View>(R.id.nav_mascotas).performClick()
        ShadowLooper.idleMainLooper()

        val lista = a.findViewById<LinearLayout>(R.id.listaMascotasContainer)
        assertEquals(1, lista.childCount)
        assertEquals("1 mascota · 1 en el historial", texto(a, R.id.tvPetsCount))

        a.findViewById<View>(R.id.chipHistoricas).performClick()
        ShadowLooper.idleMainLooper()

        assertEquals(1, a.findViewById<LinearLayout>(R.id.listaMascotasContainer).childCount)
    }

    @Test
    fun dueno_veterinariosMuestraHastaCuandoValeElPermiso() {
        val hasta = hoy.plusMonths(2)
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", venceEl = hasta.toString()))
        val a = abrirDueno()
        a.irAVeterinarios()
        ShadowLooper.idleMainLooper(1, TimeUnit.SECONDS)

        val estados = (0 until a.findViewById<LinearLayout>(R.id.listaVeterinarios).childCount).map {
            a.findViewById<LinearLayout>(R.id.listaVeterinarios).getChildAt(it).findViewById<TextView>(R.id.tvEstado).text.toString()
        }
        assertEquals(1, estados.size)
        assertTrue(estados[0].startsWith("Con acceso hasta"))
        assertEquals(View.VISIBLE, a.findViewById<LinearLayout>(R.id.listaVeterinarios).getChildAt(0).findViewById<View>(R.id.btnVencimiento).visibility)
    }

    @Test
    fun dueno_recordatoriosMuestraLosHechosAManoEnLaSolapaMios() {
        fuente.recordatoriosGuardados.add(
            RecordatorioDto("r1", "m1", Escenario.DUENO_ID, "Bañar a Rex", "higiene", hoy.plusDays(3).toString())
        )
        fuente.recordatoriosGuardados.add(
            RecordatorioDto("r2", "m1", Escenario.VET_ID, "Control de peso", "control", hoy.plusDays(9).toString())
        )
        val a = abrirDueno()
        a.irARecordatorios()
        ShadowLooper.idleMainLooper(1, TimeUnit.SECONDS)
        a.findViewById<View>(R.id.btn_manuales).performClick()
        ShadowLooper.idleMainLooper(1, TimeUnit.SECONDS)

        val rv = a.findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.recyclerViewRecordatorios)
        assertEquals(2, rv.adapter!!.itemCount)
        assertEquals(View.VISIBLE, rv.visibility)
    }

    @Test
    fun vet_unInformeDeOtroDiaSeMuestraCerradoYSinBotonDeGuardar() {
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.minusDays(3).toString(), "10:00:00", estado = "completado"))
        fuente.informes.add(
            InformeDto(
                "i1", "m1", "t1", Escenario.VET_ID, "Control", "Otitis", "Gotas",
                createdAt = OffsetDateTime.now().minusDays(3).toString()
            )
        )
        ingresarComoVeterinario()

        val ficha = abrir(
            DetallePacienteActivity::class.java,
            Intent(ApplicationProvider.getApplicationContext(), DetallePacienteActivity::class.java)
                .putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, "m1")
                .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, "t1")
        )
        ShadowLooper.idleMainLooper(1, TimeUnit.SECONDS)

        assertEquals(View.VISIBLE, ficha.findViewById<View>(R.id.tvInformeCerrado).visibility)
        assertEquals(View.GONE, ficha.findViewById<View>(R.id.btnGuardarInforme).visibility)
        assertFalse(ficha.findViewById<EditText>(R.id.etDiagnostico).isEnabled)
    }

    @Test
    fun vet_unInformeDeHoyTodaviaSePuedeEditar() {
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"))
        fuente.informes.add(
            InformeDto("i1", "m1", "t1", Escenario.VET_ID, "Control", "Otitis", "Gotas", createdAt = OffsetDateTime.now().toString())
        )
        ingresarComoVeterinario()

        val ficha = abrir(
            DetallePacienteActivity::class.java,
            Intent(ApplicationProvider.getApplicationContext(), DetallePacienteActivity::class.java)
                .putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, "m1")
                .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, "t1")
        )
        ShadowLooper.idleMainLooper(1, TimeUnit.SECONDS)

        assertEquals(View.GONE, ficha.findViewById<View>(R.id.tvInformeCerrado).visibility)
        assertEquals(View.VISIBLE, ficha.findViewById<View>(R.id.btnGuardarInforme).visibility)
        assertTrue(ficha.findViewById<EditText>(R.id.etDiagnostico).isEnabled)
    }
}
