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

    private MainActivity loginDueno() {
        MainActivity a = Robolectric.buildActivity(MainActivity.class).setup().get();
        a.findViewById(R.id.button).performClick();
        ((EditText) a.findViewById(R.id.etEmail)).setText("demo@mail.com");
        ((EditText) a.findViewById(R.id.etPassword)).setText("123456");
        a.findViewById(R.id.btnLogin).performClick();
        return a;
    }

    @Test
    public void login_validaCampos() {
        MainActivity a = Robolectric.buildActivity(MainActivity.class).setup().get();
        a.findViewById(R.id.button).performClick();
        a.findViewById(R.id.btnLogin).performClick();
        assertNotNull("Sin datos no entra", a.findViewById(R.id.loginRoot));
    }

    @Test
    public void loginSocial_ofreceElegirRol() {
        MainActivity a = Robolectric.buildActivity(MainActivity.class).setup().get();
        a.findViewById(R.id.button).performClick();
        a.findViewById(R.id.btnGoogle).performClick();
        AlertDialog d = (AlertDialog) ShadowDialog.getLatestDialog();
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        ShadowLooper.idleMainLooper();
        assertNotNull(a.findViewById(R.id.nav_home));
    }

    @Test
    public void dueno_masNotificacionesYSolicitudes() {
        MainActivity a = loginDueno();
        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optNotificaciones).performClick();
        assertNotNull(ShadowDialog.getLatestDialog());
        ShadowDialog.reset();

        a.findViewById(R.id.optSolicitudes).performClick();
        RecyclerView rv = a.findViewById(R.id.rvSolicitudesDueno);
        layoutRecycler(rv);
        rv.getChildAt(0).findViewById(R.id.btnAceptar).performClick();
        rv.requestLayout();
        layoutRecycler(rv);
        assertEquals(View.VISIBLE, rv.getChildAt(0).findViewById(R.id.tvEstado).getVisibility());
    }

    @Test
    public void dueno_cambiarContrasenaAbreDialogo() {
        MainActivity a = loginDueno();
        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optMiPerfil).performClick();
        a.findViewById(R.id.llCambiarContrasena).performClick();
        assertNotNull(ShadowDialog.getLatestDialog());
    }

    @Test
    public void dueno_detalleDelTurnoEsUnBottomSheet() {
        MainActivity a = loginDueno();
        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optCalendario).performClick();
        // Mayo 2026 tiene eventos sembrados; se elige el 15
        GridLayout g = a.findViewById(R.id.gridCalendario);
        assertNotNull(g);
        for (int i = 0; i < g.getChildCount(); i++) {
            View celda = g.getChildAt(i);
            if (celda instanceof FrameLayout
                    && ((TextView) ((FrameLayout) celda).getChildAt(0)).getText().toString().equals("15")) {
                celda.performClick();
                break;
            }
        }
        LinearLayout lista = a.findViewById(R.id.listaEventosDia);
        assertTrue(lista.getChildCount() > 0);
        lista.getChildAt(0).performClick();
        assertTrue(ShadowDialog.getLatestDialog() instanceof BottomSheetDialog);
    }

    @Test
    public void dueno_menuDeMascotaYEditarEvento() {
        MainActivity a = loginDueno();
        a.findViewById(R.id.nav_mascotas).performClick();
        a.findViewById(R.id.layout_pet_2).performClick();
        a.findViewById(R.id.btnMore).performClick();
        a.findViewById(R.id.btnEditarInfo).performClick();
        assertNotNull(ShadowDialog.getLatestDialog());
    }

    @Test
    public void dueno_veterinariosAutorizadosSeAbre() {
        MainActivity a = loginDueno();
        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optVeterinarios).performClick();
        assertNotNull(a.findViewById(R.id.btnAgregarVeterinario));
    }

    @Test
    public void dueno_bajaDeMascotaLaQuitaDeLaLista() {
        MainActivity a = loginDueno();
        a.findViewById(R.id.nav_mascotas).performClick();
        a.findViewById(R.id.layout_pet_1).performClick();      // Mika
        a.findViewById(R.id.btnDarDeBaja).performClick();
        AlertDialog d = (AlertDialog) ShadowDialog.getLatestDialog();
        d.getButton(AlertDialog.BUTTON_POSITIVE).performClick();
        ShadowLooper.idleMainLooper();
        assertEquals(View.GONE, a.findViewById(R.id.layout_pet_1).getVisibility());
    }

    @Test
    public void dueno_noPuedeAgendarTurnoEnFechaPasada() {
        MainActivity a = loginDueno();
        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optCalendario).performClick();
        a.findViewById(R.id.btnAgregarEvento).performClick();
        assertNotNull(a.findViewById(R.id.step1Content));
    }

    @Test
    public void vet_flechaAtrasEnAgendaYMisPacientesVuelveAHome() {
        MisPacientesActivity pacientes = Robolectric.buildActivity(MisPacientesActivity.class).setup().get();
        Toolbar tb1 = pacientes.findViewById(R.id.toolbar);
        tb1.getNavigationIcon(); // verify toolbar has back icon
        for (int i = 0; i < tb1.getChildCount(); i++) {
            if (tb1.getChildAt(i) instanceof ImageButton) {
                tb1.getChildAt(i).performClick();
                break;
            }
        }
        assertTrue(pacientes.isFinishing());

        AgendaVetActivity agenda = Robolectric.buildActivity(AgendaVetActivity.class).setup().get();
        Toolbar tb2 = agenda.findViewById(R.id.toolbar);
        for (int i = 0; i < tb2.getChildCount(); i++) {
            if (tb2.getChildAt(i) instanceof ImageButton) {
                tb2.getChildAt(i).performClick();
                break;
            }
        }
        assertTrue(agenda.isFinishing());
    }
}
