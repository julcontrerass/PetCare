package frgp.utn.edu.petcare;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.content.Intent;
import android.view.View;

import androidx.recyclerview.widget.RecyclerView;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** Abre cada pantalla para detectar errores de inflado o de cableado en runtime. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class PantallasSmokeTest {

    private <T extends Activity> T abrir(Class<T> clase) {
        return Robolectric.buildActivity(clase).setup().get();
    }

    @Test
    public void pantallasVeterinario_seAbren() {
        abrir(HomeVeterinarioActivity.class);
        abrir(MisPacientesActivity.class);
        abrir(SolicitudesVetActivity.class);
        abrir(AgendaVetActivity.class);
        abrir(PerfilVetActivity.class);
        abrir(AgregarConsultaActivity.class);
        abrir(DetalleEventoVetActivity.class);
        abrir(HistorialClinicoVetActivity.class);
    }

    @Test
    public void detallePaciente_muestraElPacienteElegido() {
        Intent i = new Intent(androidx.test.core.app.ApplicationProvider.getApplicationContext(), DetallePacienteActivity.class);
        i.putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, 5);
        DetallePacienteActivity a = Robolectric.buildActivity(DetallePacienteActivity.class, i).setup().get();
        assertTrue(((android.widget.TextView) a.findViewById(R.id.tvPetName)).getText().toString().equals("Simba"));
    }

    @Test
    public void listaPacientes_filtraPorBusqueda() {
        MisPacientesActivity a = abrir(MisPacientesActivity.class);
        RecyclerView rv = a.findViewById(R.id.rvPacientes);
        assertTrue(rv.getAdapter().getItemCount() == PacientesRepo.INSTANCE.getPacientes().size());
        ((android.widget.EditText) a.findViewById(R.id.etBuscarPaciente)).setText("luna");
        assertTrue(rv.getAdapter().getItemCount() == 1);
    }

    @Test
    public void carnetSalud_seAbreYListaVacunas() {
        CarnetSaludActivity a = abrir(CarnetSaludActivity.class);
        RecyclerView rv = a.findViewById(R.id.rvRegistros);
        assertNotNull(rv.getAdapter());
        assertTrue(rv.getAdapter().getItemCount() > 0);
    }

    @Test
    public void mainActivity_loginRegistroYRecuperacion() {
        MainActivity a = abrir(MainActivity.class);
        a.findViewById(R.id.button2).performClick();           // Crear cuenta
        assertNotNull(a.findViewById(R.id.registroRoot));
        a.findViewById(R.id.btnBackRegistro).performClick();
        a.findViewById(R.id.button).performClick();            // Iniciar sesión
        assertNotNull(a.findViewById(R.id.loginRoot));
        a.findViewById(R.id.tvForgotPassword).performClick();
        assertNotNull(a.findViewById(R.id.recuperarRoot));
        a.findViewById(R.id.btnBackRecuperar).performClick();
        a.findViewById(R.id.tvSignUp).performClick();
        assertNotNull(a.findViewById(R.id.registroRoot));
    }

    @Test
    public void mainActivity_registroDuenoLlevaAlHome() {
        MainActivity a = abrir(MainActivity.class);
        a.findViewById(R.id.button2).performClick();
        ((android.widget.EditText) a.findViewById(R.id.etRegNombre)).setText("Ana");
        ((android.widget.EditText) a.findViewById(R.id.etRegEmail)).setText("ana@mail.com");
        ((android.widget.EditText) a.findViewById(R.id.etRegPassword)).setText("secreto1");
        ((android.widget.EditText) a.findViewById(R.id.etRegPassword2)).setText("secreto1");
        ((android.widget.CheckBox) a.findViewById(R.id.cbTerminos)).setChecked(true);
        a.findViewById(R.id.btnRegistrar).performClick();
        assertNotNull("Debe volver al login", a.findViewById(R.id.loginRoot));
        ((android.widget.EditText) a.findViewById(R.id.etEmail)).setText("ana@mail.com");
        ((android.widget.EditText) a.findViewById(R.id.etPassword)).setText("secreto1");
        a.findViewById(R.id.btnLogin).performClick();
        assertNotNull("Dueño entra al home con navbar", a.findViewById(R.id.nav_home));
    }

    @Test
    public void mainActivity_navbarDuenoRecorreTodasLasPestanas() {
        MainActivity a = abrir(MainActivity.class);
        a.findViewById(R.id.button).performClick();
        ((android.widget.EditText) a.findViewById(R.id.etEmail)).setText("demo@mail.com");
        ((android.widget.EditText) a.findViewById(R.id.etPassword)).setText("123456");
        a.findViewById(R.id.btnLogin).performClick();

        a.findViewById(R.id.nav_mascotas).performClick();
        assertNotNull(a.findViewById(R.id.layout_pet_1));
        a.findViewById(R.id.layout_pet_2).performClick();
        assertTrue("Koda", ((android.widget.TextView) a.findViewById(R.id.textView9)).getText().toString().equals("Koda"));

        a.findViewById(R.id.nav_lista).performClick();          // Recordatorios
        assertNotNull(a.findViewById(R.id.recyclerViewRecordatorios));

        a.findViewById(R.id.nav_mas).performClick();            // Más
        assertNotNull(a.findViewById(R.id.optMiPerfil));
        a.findViewById(R.id.optSolicitudes).performClick();
        assertNotNull(a.findViewById(R.id.rvSolicitudesDueno));

        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optMiPerfil).performClick();
        assertNotNull(a.findViewById(R.id.tvUserName));

        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optCalendario).performClick();
        a.findViewById(R.id.nav_mas).performClick();
        a.findViewById(R.id.optCerrarSesion).performClick();
        View volverAlInicio = a.findViewById(R.id.button);
        assertNotNull(volverAlInicio);
    }
}
