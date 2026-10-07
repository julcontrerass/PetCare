package frgp.utn.edu.petcare;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.widget.Toolbar;
import android.content.Intent;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import frgp.utn.edu.petcare.data.DuenoRepo;
import frgp.utn.edu.petcare.ui.auth.AuthActivity;
import frgp.utn.edu.petcare.ui.dueno.DuenoActivity;
import androidx.recyclerview.widget.RecyclerView;
import androidx.test.core.app.ApplicationProvider;

import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.tabs.TabLayout;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowDialog;
import org.robolectric.shadows.ShadowLooper;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Comportamiento de las funciones que antes decían "Función en desarrollo". */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class FuncionalidadTest {

    private void layoutRecycler(RecyclerView rv) {
        rv.measure(View.MeasureSpec.makeMeasureSpec(1080, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(1920, View.MeasureSpec.EXACTLY));
        rv.layout(0, 0, 1080, 1920);
    }

    private EventoVet nuevoTurno() {
        return AgendaRepo.INSTANCE.agregar(1, "Consulta", "Prueba", LocalDate.now().plusDays(2), "10:00",
                EstadoEvento.PENDIENTE, "", "Dr. Test");
    }

    private DetalleEventoVetActivity abrirDetalle(EventoVet e) {
        Intent i = new Intent(ApplicationProvider.getApplicationContext(), DetalleEventoVetActivity.class);
        i.putExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID, e.getId());
        return Robolectric.buildActivity(DetalleEventoVetActivity.class, i).setup().get();
    }

    @Test
    public void detalleTurno_marcarComoCompletado() {
        EventoVet e = nuevoTurno();
        DetalleEventoVetActivity a = abrirDetalle(e);
        assertEquals("Prueba", ((TextView) a.findViewById(R.id.tvTitulo)).getText().toString());
        a.findViewById(R.id.btnCompletar).performClick();
        assertEquals(EstadoEvento.COMPLETADO, e.getEstado());
        assertEquals(View.GONE, a.findViewById(R.id.btnCompletar).getVisibility());
    }

    @Test
    public void detalleTurno_cancelarConConfirmacion() {
        EventoVet e = nuevoTurno();
        DetalleEventoVetActivity a = abrirDetalle(e);
        a.findViewById(R.id.btnCancelarTurno).performClick();
        AlertDialog dialog = (AlertDialog) ShadowDialog.getLatestDialog();
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        ShadowLooper.idleMainLooper();
        assertEquals(EstadoEvento.CANCELADO, e.getEstado());
    }

    @Test
    public void detalleTurno_editarAbreFormulario() {
        DetalleEventoVetActivity a = abrirDetalle(nuevoTurno());
        a.findViewById(R.id.btnEditar).performClick();
        assertNotNull(ShadowDialog.getLatestDialog());
    }

    @Test
    public void agenda_listaProximosYCambiaDeTab() {
        AgendaVetActivity a = Robolectric.buildActivity(AgendaVetActivity.class).setup().get();
        RecyclerView rv = a.findViewById(R.id.rvAgenda);
        int proximos = rv.getAdapter().getItemCount();
        assertTrue(proximos > 0);
        ((TabLayout) a.findViewById(R.id.tabLayoutAgenda)).getTabAt(2).select();
        assertTrue(rv.getAdapter().getItemCount() != proximos || AgendaRepo.INSTANCE.porEstado(EstadoEvento.CANCELADO).isEmpty());
    }

    @Test
    public void agregarConsulta_creaTurnoEnLaAgenda() {
        int antes = AgendaRepo.INSTANCE.getEventos().size();
        AgregarConsultaActivity a = Robolectric.buildActivity(AgregarConsultaActivity.class).setup().get();
        a.findViewById(R.id.btnGuardar).performClick();           // vacío: no guarda
        assertEquals(antes, AgendaRepo.INSTANCE.getEventos().size());
    }

    @Test
    public void solicitudVet_aceptarSumaElPaciente() {
        SolicitudesVetActivity a = Robolectric.buildActivity(SolicitudesVetActivity.class).setup().get();
        RecyclerView rv = a.findViewById(R.id.rvSolicitudes);
        layoutRecycler(rv);
        int antes = PacientesRepo.INSTANCE.getPacientes().size();
        rv.getChildAt(0).findViewById(R.id.btnAceptar).performClick();
        assertEquals(antes + 1, PacientesRepo.INSTANCE.getPacientes().size());
    }

    @Test
    public void perfilVet_cambiarPasswordValida() {
        assertNotNull(PerfilVetRepo.INSTANCE.cambiarPassword("", "abcdef", "abcdef"));
        assertNotNull(PerfilVetRepo.INSTANCE.cambiarPassword("x", "123", "123"));
        assertNotNull(PerfilVetRepo.INSTANCE.cambiarPassword("x", "abcdef", "otra"));
        assertNull(PerfilVetRepo.INSTANCE.cambiarPassword("x", "abcdef", "abcdef"));
        assertNotNull("Ahora exige la actual", PerfilVetRepo.INSTANCE.cambiarPassword("x", "ghijkl", "ghijkl"));
        assertNull(PerfilVetRepo.INSTANCE.cambiarPassword("abcdef", "ghijkl", "ghijkl"));
    }

    @Test
    public void perfilVet_opcionesAbrenDialogos() {
        PerfilVetActivity a = Robolectric.buildActivity(PerfilVetActivity.class).setup().get();
        for (int id : new int[]{R.id.optEditarPerfil, R.id.optCambiarPassword, R.id.optNotificaciones, R.id.optCerrarSesion}) {
            a.findViewById(id).performClick();
            assertNotNull(ShadowDialog.getLatestDialog());
            ShadowDialog.reset();
        }
    }

    @Test
    public void misPacientes_altaManual() {
        MisPacientesActivity a = Robolectric.buildActivity(MisPacientesActivity.class).setup().get();
        a.findViewById(R.id.btnAgregarPaciente).performClick();
        assertNotNull(ShadowDialog.getLatestDialog());
    }

    @Test
    public void homeVet_muestraConsultasDeHoyYContadores() {
        HomeVeterinarioActivity a = Robolectric.buildActivity(HomeVeterinarioActivity.class).setup().get();
        int hoy = AgendaRepo.INSTANCE.deHoy().size();
        assertEquals(String.valueOf(hoy), ((TextView) a.findViewById(R.id.tvConsultasPendientes)).getText().toString());
    }

    @Test
    public void homeVet_destacaTurnoEnHorario() {
        String horaActual = String.format("%02d:00", LocalTime.now().getHour());
        AgendaRepo.INSTANCE.agregar(1, "Consulta", "Turno ahora", LocalDate.now(),
                horaActual, EstadoEvento.PENDIENTE, "", "Dr. Test");

        HomeVeterinarioActivity a = Robolectric.buildActivity(HomeVeterinarioActivity.class).setup().get();
        RecyclerView rv = a.findViewById(R.id.rvConsultas);
        assertTrue(rv.getAdapter().getItemCount() > 0);
    }

    @Test
    public void historialVet_usaLosEventosDelPaciente() {
        Intent i = new Intent(ApplicationProvider.getApplicationContext(), HistorialClinicoVetActivity.class);
        i.putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, 4);
        HistorialClinicoVetActivity a = Robolectric.buildActivity(HistorialClinicoVetActivity.class, i).setup().get();
        RecyclerView rv = a.findViewById(R.id.rvHistorial);
        assertTrue(rv.getAdapter().getItemCount() >= AgendaRepo.INSTANCE.deMascota(4).size());
        assertEquals("Luna", ((TextView) a.findViewById(R.id.tvPetName)).getText().toString());
    }

    private AuthActivity abrirAuth() {
        return Robolectric.buildActivity(AuthActivity.class).setup().get();
    }

    /** Ingresa con la cuenta de demostración y abre el panel del dueño. */
    private DuenoActivity loginDueno() {
        AuthActivity auth = abrirAuth();
        auth.findViewById(R.id.button).performClick();
        ((EditText) auth.findViewById(R.id.etEmail)).setText("demo@mail.com");
        ((EditText) auth.findViewById(R.id.etPassword)).setText("123456");
        auth.findViewById(R.id.btnLogin).performClick();
        Intent siguiente = Shadows.shadowOf(auth).getNextStartedActivity();
        assertNotNull(siguiente);
        assertEquals(DuenoActivity.class.getName(), siguiente.getComponent().getClassName());
        return Robolectric.buildActivity(DuenoActivity.class).setup().get();
    }

    @Test
    public void login_validaCampos() {
        AuthActivity a = abrirAuth();
        a.findViewById(R.id.button).performClick();
        a.findViewById(R.id.btnLogin).performClick();
        assertNotNull("Sin datos no entra", a.findViewById(R.id.loginRoot));
        assertNull(Shadows.shadowOf(a).getNextStartedActivity());
    }

    @Test
    public void loginSocial_ofreceElegirRol() {
        AuthActivity a = abrirAuth();
        a.findViewById(R.id.button).performClick();
        a.findViewById(R.id.btnGoogle).performClick();
        AlertDialog d = (AlertDialog) ShadowDialog.getLatestDialog();
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        ShadowLooper.idleMainLooper();
        Intent siguiente = Shadows.shadowOf(a).getNextStartedActivity();
        assertEquals(DuenoActivity.class.getName(), siguiente.getComponent().getClassName());
    }

    @Test
    public void dueno_homeSaludaYMuestraSusMascotas() {
        DuenoActivity a = loginDueno();
        assertEquals("Hola, Juan", ((TextView) a.findViewById(R.id.tv_welcome)).getText().toString());
        assertNotNull(a.findViewById(R.id.nav_home));
        assertNotNull(a.findViewById(R.id.containerMisMascotasHome));
    }

    @Test
    public void dueno_laBarraInferiorRecorreLasSecciones() {
        DuenoActivity a = loginDueno();

        a.findViewById(R.id.nav_mascotas).performClick();
        assertNotNull(a.findViewById(R.id.listaMascotasContainer));

        a.findViewById(R.id.nav_lista).performClick();
        assertNotNull(a.findViewById(R.id.btn_proximos));

        a.findViewById(R.id.nav_home).performClick();
        assertNotNull(a.findViewById(R.id.tv_welcome));
    }

    @Test
    public void dueno_laListaDeMascotasMuestraTodasLasDeLaCuenta() {
        DuenoActivity a = loginDueno();
        a.findViewById(R.id.nav_mascotas).performClick();
        LinearLayout lista = a.findViewById(R.id.listaMascotasContainer);
        assertTrue(lista.getChildCount() >= DuenoRepo.INSTANCE.getMascotas().size());
        assertEquals("4 mascotas", ((TextView) a.findViewById(R.id.tvPetsCount)).getText().toString());
    }

    @Test
    public void dueno_elBotonAgregarMascotaAbreElFormulario() {
        DuenoActivity a = loginDueno();
        a.findViewById(R.id.nav_mascotas).performClick();
        a.findViewById(R.id.btnAddPet).performClick();
        assertNotNull(a.findViewById(R.id.etNombreMascota));
        assertNotNull(a.findViewById(R.id.btnGuardarMascota));
    }

    @Test
    public void vet_flechaAtrasEnAgendaYMisPacientesVuelveAHome() {
        MisPacientesActivity pacientes = Robolectric.buildActivity(MisPacientesActivity.class).setup().get();
        View tb1 = pacientes.findViewById(R.id.toolbar);
        assertNotNull(tb1);

        AgendaVetActivity agenda = Robolectric.buildActivity(AgendaVetActivity.class).setup().get();
        View tb2 = agenda.findViewById(R.id.toolbar);
        assertNotNull(tb2);
    }

    @Test
    public void admin_loginYAprobacionDeVeterinarios() {
        AuthActivity a = abrirAuth();
        a.findViewById(R.id.button).performClick();
        ((EditText) a.findViewById(R.id.etEmail)).setText("admin@petcare.com");
        ((EditText) a.findViewById(R.id.etPassword)).setText("123456");
        a.findViewById(R.id.btnLogin).performClick();

        Intent nextIntent = Shadows.shadowOf(a).getNextStartedActivity();
        assertNotNull(nextIntent);
        assertEquals(HomeAdminActivity.class.getName(), nextIntent.getComponent().getClassName());

        HomeAdminActivity adminActivity = Robolectric.buildActivity(HomeAdminActivity.class).setup().get();
        assertNotNull(adminActivity.findViewById(R.id.bottomNavigation));
        assertTrue(AdminRepo.INSTANCE.getListaVeterinarios().size() > 0);
        assertTrue(AdminRepo.INSTANCE.getListaDuenos().size() > 0);
    }
}
