package frgp.utn.edu.petcare

import android.app.Activity
import android.content.Intent
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.recyclerview.widget.RecyclerView
import androidx.test.core.app.ApplicationProvider
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.tabs.TabLayout
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.ui.auth.AuthActivity
import frgp.utn.edu.petcare.ui.dueno.DuenoActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowDialog
import org.robolectric.shadows.ShadowLooper
import java.time.LocalDate
import java.util.concurrent.TimeUnit

/** Abre cada pantalla con datos de prueba para detectar errores de inflado o de cableado. */
class PantallasTest : PruebaBase() {

    private val hoy = LocalDate.now()

    private fun <T : Activity> abrir(clase: Class<T>): T = Robolectric.buildActivity(clase).setup().get()

    private fun <T : Activity> abrir(clase: Class<T>, intent: Intent): T =
        Robolectric.buildActivity(clase, intent).setup().get()

    private fun intent(clase: Class<*>) = Intent(ApplicationProvider.getApplicationContext(), clase)

    private fun medir(rv: RecyclerView) {
        rv.measure(View.MeasureSpec.makeMeasureSpec(1080, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(2000, View.MeasureSpec.AT_MOST))
        rv.layout(0, 0, 1080, 2000)
    }

    /** Pulsa el botón principal del último cartel que se mostró (confirmar, entendido...). */
    private fun aceptarCartel() {
        (ShadowDialog.getLatestDialog() as AlertDialog).findViewById<View>(R.id.btnCartelAceptar)!!.performClick()
    }

    private fun texto(a: Activity, id: Int) = a.findViewById<TextView>(id).text.toString()

    @Before
    fun cargarEscenario() {
        fuente.perfiles.add(Escenario.dueno())
        fuente.perfiles.add(Escenario.veterinario())
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.mascotas.add(Escenario.mascota("m2", "Mia", tipo = "Gato"))
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.accesos.add(AccesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"))
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"))
        fuente.turnos.add(Escenario.turno("t2", "m2", hoy.plusDays(2).toString(), "11:00:00"))
        fuente.turnos.add(Escenario.turno("t3", "m1", hoy.minusDays(20).toString(), "09:00:00", estado = "completado"))
    }

    // ---------- Ingreso ----------

    @Test
    fun auth_navegaEntreBienvenidaIngresoRegistroYRecuperacion() {
        val a = abrir(AuthActivity::class.java)
        a.findViewById<View>(R.id.button2).performClick()
        assertNotNull(a.findViewById<View>(R.id.registroRoot))
        a.findViewById<View>(R.id.btnBackRegistro).performClick()
        a.findViewById<View>(R.id.button).performClick()
        assertNotNull(a.findViewById<View>(R.id.loginRoot))
        a.findViewById<View>(R.id.tvForgotPassword).performClick()
        assertNotNull(a.findViewById<View>(R.id.recuperarRoot))
        a.findViewById<View>(R.id.btnBackRecuperar).performClick()
        a.findViewById<View>(R.id.tvSignUp).performClick()
        assertNotNull(a.findViewById<View>(R.id.registroRoot))
    }

    @Test
    fun auth_elLoginYaNoOfreceRolNiCuentasSociales() {
        val a = abrir(AuthActivity::class.java)
        a.findViewById<View>(R.id.button).performClick()

        assertNull(a.findViewById<View>(resourceId("btnRoleDueno")))
        assertNull(a.findViewById<View>(resourceId("btnGoogle")))
    }

    private fun resourceId(nombre: String) =
        ApplicationProvider.getApplicationContext<android.app.Application>().resources
            .getIdentifier(nombre, "id", "frgp.utn.edu.petcare")

    @Test
    fun auth_elRegistroOfreceLosDosAsistentes() {
        val a = abrir(AuthActivity::class.java)
        a.findViewById<View>(R.id.button2).performClick()
        assertNotNull(a.findViewById<View>(R.id.btnComenzarDueno))
        a.findViewById<View>(R.id.btnRegRoleVet).performClick()
        assertEquals(View.VISIBLE, a.findViewById<View>(R.id.llAvisoVet).visibility)
        assertEquals(View.GONE, a.findViewById<View>(R.id.llAvisoDueno).visibility)
    }

    @Test
    fun login_validaLosCampos() {
        val a = abrir(AuthActivity::class.java)
        a.findViewById<View>(R.id.button).performClick()
        a.findViewById<View>(R.id.btnLogin).performClick()

        assertNotNull(a.findViewById<View>(R.id.loginRoot))
        assertNull(shadowOf(a).nextStartedActivity)
        assertFalse(Sesion.activa)
    }

    private fun iniciarSesionDesdeLogin(perfil: frgp.utn.edu.petcare.data.remoto.PerfilDto): Intent? {
        fuente.yo = perfil
        val a = abrir(AuthActivity::class.java)
        a.findViewById<View>(R.id.button).performClick()
        a.findViewById<EditText>(R.id.etEmail).setText(perfil.email)
        a.findViewById<EditText>(R.id.etPassword).setText("123456")
        a.findViewById<View>(R.id.btnLogin).performClick()
        return shadowOf(a).nextStartedActivity
    }

    @Test
    fun login_cadaRolEntraASuPanel() {
        assertEquals(DuenoActivity::class.java.name, iniciarSesionDesdeLogin(Escenario.dueno())!!.component!!.className)
        Sesion.olvidar()
        assertEquals(HomeVeterinarioActivity::class.java.name, iniciarSesionDesdeLogin(Escenario.veterinario())!!.component!!.className)
        Sesion.olvidar()
        assertEquals(HomeAdminActivity::class.java.name, iniciarSesionDesdeLogin(Escenario.admin())!!.component!!.className)
    }

    @Test
    fun login_unaCuentaEnRevisionMuestraElMotivoYNoEntra() {
        val destino = iniciarSesionDesdeLogin(Escenario.veterinario(estado = "pendiente_revision"))

        assertNull(destino)
        val dialogo = ShadowDialog.getLatestDialog() as AlertDialog
        assertTrue(dialogo.isShowing)
        assertFalse(Sesion.activa)
    }

    @Test
    fun pantallasSinSesion_vuelvenAlIngreso() {
        val a = abrir(HomeVeterinarioActivity::class.java)

        assertTrue(a.isFinishing)
        assertEquals(AuthActivity::class.java.name, shadowOf(a).nextStartedActivity.component!!.className)
    }

    // ---------- Dueño ----------

    private fun abrirDueno(): DuenoActivity {
        ingresarComoDueno()
        return abrir(DuenoActivity::class.java)
    }

    @Test
    fun dueno_homeSaludaYMuestraSusMascotas() {
        val a = abrirDueno()

        assertEquals("Hola, Ana", texto(a, R.id.tv_welcome))
        assertNotNull(a.findViewById<View>(R.id.containerMisMascotasHome))
    }

    @Test
    fun dueno_laBarraInferiorRecorreLasSecciones() {
        val a = abrirDueno()

        a.findViewById<View>(R.id.nav_mascotas).performClick()
        ShadowLooper.idleMainLooper()
        assertNotNull(a.findViewById<View>(R.id.listaMascotasContainer))
        a.findViewById<View>(R.id.nav_lista).performClick()
        ShadowLooper.idleMainLooper()
        assertNotNull(a.findViewById<View>(R.id.btn_proximos))
        a.findViewById<View>(R.id.nav_home).performClick()
        ShadowLooper.idleMainLooper()
        assertNotNull(a.findViewById<View>(R.id.tv_welcome))
    }

    @Test
    fun dueno_laListaMuestraTodasLasMascotasDeLaCuenta() {
        val a = abrirDueno()
        a.findViewById<View>(R.id.nav_mascotas).performClick()
        ShadowLooper.idleMainLooper()

        val lista = a.findViewById<LinearLayout>(R.id.listaMascotasContainer)
        assertTrue(lista.childCount >= DuenoRepo.mascotas.size)
        assertEquals("2 mascotas", texto(a, R.id.tvPetsCount))
    }

    @Test
    fun dueno_tocarUnItemDelHistorialAbreElDetalleDelTurno() {
        val a = abrirDueno()
        a.findViewById<View>(R.id.nav_mascotas).performClick()
        ShadowLooper.idleMainLooper()
        a.findViewById<LinearLayout>(R.id.listaMascotasContainer).getChildAt(0).performClick()
        a.findViewById<TabLayout>(R.id.tabLayout).getTabAt(1)!!.select()
        ShadowLooper.idleMainLooper(1, TimeUnit.SECONDS)

        val rv = a.findViewById<RecyclerView>(R.id.recyclerViewHistorial)
        medir(rv)
        rv.findViewHolderForAdapterPosition(0)!!.itemView.findViewById<View>(R.id.tarjetaHistorial).performClick()

        assertTrue(ShadowDialog.getLatestDialog() is BottomSheetDialog)
    }

    @Test
    fun dueno_editarUnTurnoUsaElAsistenteConLosHorariosDelVeterinario() {
        val lunes = LocalDate.now().with(java.time.temporal.TemporalAdjusters.next(java.time.DayOfWeek.MONDAY))
        fuente.turnos.clear()
        fuente.turnos.add(Escenario.turno("t5", "m1", lunes.toString(), "10:00:00"))
        val a = abrirDueno()

        a.dialogosEventos.editar(DuenoRepo.eventos.single())
        ShadowLooper.idleMainLooper()

        assertEquals("Editar turno", texto(a, R.id.tvTitle))
        assertEquals(View.VISIBLE, a.findViewById<View>(R.id.step2Content).visibility)
        assertEquals(View.GONE, a.findViewById<View>(R.id.step1Content).visibility)
        assertTrue(texto(a, R.id.tvTurnoActual).contains("10:00"))
        // Las horas que se ofrecen son las del veterinario (09:00 a 12:00 cada 30 minutos)
        assertEquals(6, a.findViewById<android.widget.GridLayout>(R.id.gridHoras).childCount)

        // Sin cambios no se guarda nada
        a.findViewById<View>(R.id.btnSiguienteGuardar).performClick()
        assertTrue(fuente.llamadas.none { it.startsWith("turno:t5") })

        // Con un cambio sí
        a.findViewById<EditText>(R.id.etObservaciones).setText("Llegamos 10 minutos antes")
        a.findViewById<View>(R.id.btnSiguienteGuardar).performClick()
        ShadowLooper.idleMainLooper()

        assertTrue(fuente.llamadas.any { it.startsWith("turno:t5:") && it.contains("notas=Llegamos 10 minutos antes") })
    }

    @Test
    fun dueno_elegirQueTurnoEditarMuestraSoloLosProximos() {
        val lunes = LocalDate.now().with(java.time.temporal.TemporalAdjusters.next(java.time.DayOfWeek.MONDAY))
        fuente.turnos.clear()
        fuente.turnos.add(Escenario.turno("t5", "m1", lunes.toString(), "10:00:00"))
        fuente.turnos.add(Escenario.turno("t6", "m1", lunes.plusDays(1).toString(), "11:00:00", estado = "completado"))
        val a = abrirDueno()

        a.dialogosEventos.elegirParaEditar("Rex")

        val hoja = ShadowDialog.getLatestDialog() as BottomSheetDialog
        val lista = hoja.findViewById<LinearLayout>(R.id.llTurnosEditables)!!
        assertEquals(1, lista.childCount)
        lista.getChildAt(0).performClick()
        ShadowLooper.idleMainLooper()
        assertEquals("Editar turno", texto(a, R.id.tvTitle))
    }

    @Test
    fun dueno_elBotonAgregarMascotaAbreElFormulario() {
        val a = abrirDueno()
        a.findViewById<View>(R.id.nav_mascotas).performClick()
        ShadowLooper.idleMainLooper()
        a.findViewById<View>(R.id.btnAddPet).performClick()

        assertNotNull(a.findViewById<View>(R.id.etNombreMascota))
        assertNotNull(a.findViewById<View>(R.id.btnGuardarMascota))
    }

    @Test
    fun dueno_guardarUnaMascotaNuevaLaMandaAlServidor() {
        val a = abrirDueno()
        a.findViewById<View>(R.id.nav_mascotas).performClick()
        ShadowLooper.idleMainLooper()
        a.findViewById<View>(R.id.btnAddPet).performClick()
        a.findViewById<EditText>(R.id.etNombreMascota).setText("Toto")
        a.findViewById<android.widget.GridLayout>(R.id.gridTiposMascota).getChildAt(0).performClick()
        a.findViewById<View>(R.id.btnGuardarMascota).performClick()

        assertTrue(fuente.llamadas.contains("crearMascota:Toto"))
        assertNotNull(DuenoRepo.buscarMascota("Toto"))
    }

    @Test
    fun dueno_elPerfilMuestraSusDatosYCierraSesion() {
        val a = abrirDueno()
        a.irAPerfil()

        assertEquals("Ana Prueba", texto(a, R.id.tvUserName))
        assertEquals(Escenario.DUENO_ID + "@prueba.test", texto(a, R.id.tvUserEmailValue))

        a.findViewById<View>(R.id.llCerrarSesion).performClick()
        assertEquals(AuthActivity::class.java.name, shadowOf(a).nextStartedActivity.component!!.className)
        assertFalse(Sesion.activa)
    }

    @Test
    fun dueno_eliminarCuentaPideConfirmacion() {
        val a = abrirDueno()
        a.irAPerfil()
        a.findViewById<View>(R.id.llEliminarCuenta).performClick()

        aceptarCartel()
        ShadowLooper.idleMainLooper()

        assertTrue(fuente.llamadas.contains("eliminarCuenta"))
        assertTrue(fuente.llamadas.any { it.startsWith("borrar:fotos") })
        assertFalse(Sesion.activa)
    }

    // ---------- Veterinario ----------

    private fun abrirVet() = ingresarComoVeterinario()

    @Test
    fun vet_todasLasPantallasSeAbren() {
        abrirVet()
        abrir(HomeVeterinarioActivity::class.java)
        abrir(MisPacientesActivity::class.java)
        abrir(SolicitudesVetActivity::class.java)
        abrir(AgendaVetActivity::class.java)
        abrir(PerfilVetActivity::class.java)
        abrir(AgregarConsultaActivity::class.java)
        abrir(CarnetSaludActivity::class.java)
    }

    @Test
    fun vet_homeMuestraLosTurnosDeHoy() {
        abrirVet()
        val a = abrir(HomeVeterinarioActivity::class.java)

        assertEquals("Hola, Dr. Vera", texto(a, R.id.tvGreeting))
        assertEquals("1", texto(a, R.id.tvConsultasPendientes))
        assertEquals(1, a.findViewById<RecyclerView>(R.id.rvConsultas).adapter!!.itemCount)
    }

    @Test
    fun vet_detalleDelPacienteMuestraLosDatos() {
        abrirVet()
        val intent = intent(DetallePacienteActivity::class.java).putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, "m2")
        val a = abrir(DetallePacienteActivity::class.java, intent)

        assertEquals("Mia", texto(a, R.id.tvPetName))
    }

    @Test
    fun vet_unPacienteInexistenteCierraLaPantalla() {
        abrirVet()
        val intent = intent(DetallePacienteActivity::class.java).putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, "no-existe")

        assertTrue(abrir(DetallePacienteActivity::class.java, intent).isFinishing)
    }

    @Test
    fun vet_listaDePacientesFiltraPorBusqueda() {
        abrirVet()
        val a = abrir(MisPacientesActivity::class.java)
        val rv = a.findViewById<RecyclerView>(R.id.rvPacientes)
        assertEquals(2, rv.adapter!!.itemCount)

        a.findViewById<EditText>(R.id.etBuscarPaciente).setText("mia")

        assertEquals(1, rv.adapter!!.itemCount)
    }

    private fun abrirDetalleTurno(id: String): DetalleEventoVetActivity {
        val intent = intent(DetalleEventoVetActivity::class.java).putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, id)
        return abrir(DetalleEventoVetActivity::class.java, intent)
    }

    @Test
    fun vet_detalleDelTurnoSePuedeCompletar() {
        abrirVet()
        val a = abrirDetalleTurno("t1")
        a.findViewById<View>(R.id.btnCompletar).performClick()

        assertEquals(EstadoEvento.COMPLETADO, AgendaRepo.porId("t1")!!.estado)
        assertEquals("completado", fuente.turnos.first { it.id == "t1" }.estado)
        assertEquals(View.GONE, a.findViewById<View>(R.id.btnCompletar).visibility)
    }

    @Test
    fun vet_detalleDelTurnoSePuedeCancelarConConfirmacion() {
        abrirVet()
        val a = abrirDetalleTurno("t1")
        a.findViewById<View>(R.id.btnCancelarTurno).performClick()
        aceptarCartel()
        ShadowLooper.idleMainLooper()

        assertEquals("cancelado", fuente.turnos.first { it.id == "t1" }.estado)
    }

    @Test
    fun vet_guardarElInformeDelTurnoOfreceCompletarloYLoMuestraAlVolver() {
        abrirVet()
        val detalle = Robolectric.buildActivity(
            DetalleEventoVetActivity::class.java,
            intent(DetalleEventoVetActivity::class.java).putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, "t1")
        ).setup()
        assertEquals("Iniciar turno", detalle.get().findViewById<android.widget.Button>(R.id.btnIniciarTurno).text.toString())

        val ficha = abrir(
            DetallePacienteActivity::class.java,
            intent(DetallePacienteActivity::class.java)
                .putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, "m1")
                .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, "t1")
        )
        ficha.findViewById<EditText>(R.id.etDiagnostico).setText("Otitis")
        ficha.findViewById<EditText>(R.id.etTratamiento).setText("Gotas por 7 días")
        ficha.findViewById<View>(R.id.btnGuardarInforme).performClick()

        // El informe se guarda atado al turno y se ofrece cerrar el turno
        assertTrue(fuente.llamadas.contains("crearInforme:m1"))
        assertEquals("pendiente", fuente.turnos.first { it.id == "t1" }.estado)
        aceptarCartel()
        assertEquals("completado", fuente.turnos.first { it.id == "t1" }.estado)
        assertTrue(ficha.isFinishing)

        // Al volver al turno se ve el informe y ya no se puede iniciar
        fuente.informes.add(
            frgp.utn.edu.petcare.data.remoto.InformeDto("i1", "m1", "t1", Escenario.VET_ID, "Control", "Otitis", "Gotas por 7 días")
        )
        val a = detalle.resume().get()
        assertEquals(View.VISIBLE, a.findViewById<View>(R.id.seccionInforme).visibility)
        assertTrue(texto(a, R.id.tvInforme).contains("Otitis"))
        assertEquals(View.GONE, a.findViewById<View>(R.id.btnIniciarTurno).visibility)
    }

    @Test
    fun vet_elInformeSinDiagnosticoNiTratamientoNoSeGuarda() {
        abrirVet()
        val ficha = abrir(
            DetallePacienteActivity::class.java,
            intent(DetallePacienteActivity::class.java).putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, "m1")
                .putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, "t1")
        )
        ficha.findViewById<View>(R.id.btnGuardarInforme).performClick()

        assertTrue(fuente.llamadas.none { it.startsWith("crearInforme") })
    }

    @Test
    fun vet_editarElTurnoAbreElFormulario() {
        abrirVet()
        abrirDetalleTurno("t1").findViewById<View>(R.id.btnEditar).performClick()

        assertNotNull(ShadowDialog.getLatestDialog())
    }

    @Test
    fun vet_agendaListaLosProximosYCambiaDeSolapa() {
        abrirVet()
        val a = abrir(AgendaVetActivity::class.java)
        val rv = a.findViewById<RecyclerView>(R.id.rvAgenda)
        val proximos = rv.adapter!!.itemCount
        assertTrue(proximos > 0)

        a.findViewById<TabLayout>(R.id.tabLayoutAgenda).getTabAt(1)!!.select()

        assertEquals(2, rv.adapter!!.itemCount) // un encabezado de fecha y el turno completado
    }

    @Test
    fun vet_guardarUnaConsultaVaciaNoCreaNada() {
        abrirVet()
        val a = abrir(AgregarConsultaActivity::class.java)
        a.findViewById<View>(R.id.btnGuardar).performClick()

        assertTrue(fuente.llamadas.none { it.startsWith("crearTurno") })
    }

    @Test
    fun vet_solicitudAceptadaSumaElPaciente() {
        fuente.mascotas.add(Escenario.mascota("m3", "Nueva"))
        fuente.accesos.add(AccesoDto("a3", "m3", Escenario.VET_ID, "pendiente", "dueno"))
        abrirVet()
        val a = abrir(SolicitudesVetActivity::class.java)
        val rv = a.findViewById<RecyclerView>(R.id.rvSolicitudes)
        medir(rv)

        rv.getChildAt(0).findViewById<View>(R.id.btnAceptar).performClick()

        assertNotNull(PacientesRepo.porId("m3"))
        assertEquals("activo", fuente.accesos.first { it.id == "a3" }.estado)
    }

    @Test
    fun vet_elPerfilMuestraSusDatosYAbreLasOpciones() {
        abrirVet()
        val a = abrir(PerfilVetActivity::class.java)

        assertEquals("Dr. Vera", texto(a, R.id.tvNombreVet))
        assertEquals("Matrícula MP-100", texto(a, R.id.tvDatosVet))
        for (id in intArrayOf(R.id.optEditarPerfil, R.id.optCambiarPassword, R.id.optNotificaciones, R.id.optCerrarSesion, R.id.optEliminarCuenta)) {
            a.findViewById<View>(id).performClick()
            assertNotNull(ShadowDialog.getLatestDialog())
            ShadowDialog.reset()
        }
    }

    @Test
    fun vet_cerrarSesionVuelveAlIngreso() {
        abrirVet()
        val a = abrir(PerfilVetActivity::class.java)
        a.findViewById<View>(R.id.optCerrarSesion).performClick()
        aceptarCartel()
        ShadowLooper.idleMainLooper()

        assertEquals(AuthActivity::class.java.name, shadowOf(a).nextStartedActivity.component!!.className)
        assertFalse(Sesion.activa)
    }

    @Test
    fun vet_carnetListaLasVacunas() {
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto("r1", "m1", "vacuna", "Rabia", null, hoy.toString(), null, hoy.plusDays(100).toString())
        )
        abrirVet()
        val a = abrir(CarnetSaludActivity::class.java)

        assertEquals(1, a.findViewById<RecyclerView>(R.id.rvRegistros).adapter!!.itemCount)
    }

    // ---------- Administrador ----------

    @Test
    fun admin_elPanelMuestraCuentasYCierraSesion() {
        fuente.resumen = Escenario.resumen("mascotas" to 2, "turnos_hoy" to 1)
        ingresarComo(Escenario.admin())
        val admin = abrir(HomeAdminActivity::class.java)

        assertNotNull(admin.findViewById<View>(R.id.bottomNavigation))
        assertEquals("1", texto(admin, R.id.tvStatTurnos))
        assertEquals("2", texto(admin, R.id.tvStatMascotas))

        admin.findViewById<View>(R.id.btnAdminCuenta).performClick()
        val hoja = ShadowDialog.getLatestDialog()
        assertTrue(hoja is BottomSheetDialog)
        assertEquals(Escenario.ADMIN_ID + "@prueba.test", hoja!!.findViewById<TextView>(R.id.tvCuentaEmail).text.toString())

        hoja.findViewById<View>(R.id.btnCuentaCerrarSesion).performClick()
        assertEquals(AuthActivity::class.java.name, shadowOf(admin).nextStartedActivity.component!!.className)
    }
}
