package frgp.utn.edu.petcare;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import frgp.utn.edu.petcare.data.CuentasRepo;
import frgp.utn.edu.petcare.data.DuenoRepo;
import frgp.utn.edu.petcare.model.EstadoAcceso;
import frgp.utn.edu.petcare.model.EventoMascota;
import frgp.utn.edu.petcare.model.Mascota;
import frgp.utn.edu.petcare.model.Sexo;
import frgp.utn.edu.petcare.model.TipoNotificacion;
import frgp.utn.edu.petcare.model.VeterinarioAcceso;

/** Reglas de negocio de la cuenta del dueño: cada prueba trabaja con una cuenta nueva para no pisar a las demás. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class DuenoRepoTest {

    private static int contador = 0;

    private static MascotaRegistro mascota(String nombre, String tipo) {
        return new MascotaRegistro(nombre, tipo, "Macho", "", "", null, "", "", "", "");
    }

    /** Registra un dueño nuevo con las mascotas indicadas y deja su sesión abierta. */
    private static String nuevoDueno(MascotaRegistro... mascotas) {
        String email = "dueno" + (++contador) + "@test.com";
        DatosRegistroDueno datos = new DatosRegistroDueno(
                "Dueño Prueba", "30111222", "1100000000", "Calle 1, CABA", email, "123456",
                null, Arrays.asList(mascotas));
        CuentasRepo.INSTANCE.registrarDueno(datos);
        DuenoRepo.INSTANCE.entrar(email);
        return email;
    }

    @Test
    public void cuentaNuevaArrancaSoloConLoQueCargo() {
        nuevoDueno(mascota("Rex", "Perro"), mascota("Michi", "Gato"));
        assertFalse(DuenoRepo.INSTANCE.getEsDemo());
        assertEquals(2, DuenoRepo.INSTANCE.getMascotas().size());
        assertTrue(DuenoRepo.INSTANCE.getEventos().isEmpty());
        assertTrue(DuenoRepo.INSTANCE.getAutorizados().isEmpty());
        assertTrue(DuenoRepo.INSTANCE.getSolicitudes().isEmpty());
        assertEquals("Dueño", DuenoRepo.INSTANCE.getPerfil().getPrimerNombre());
    }

    @Test
    public void cuentaDeDemostracionTieneSusDatosDeEjemplo() {
        DuenoRepo.INSTANCE.entrar("");
        assertTrue(DuenoRepo.INSTANCE.getEsDemo());
        assertEquals(4, DuenoRepo.INSTANCE.getMascotas().size());
        assertFalse(DuenoRepo.INSTANCE.getEventos().isEmpty());
        assertNotNull(DuenoRepo.INSTANCE.buscarMascota("Koda"));
    }

    @Test
    public void cambiarDeCuentaNoMezclaLosDatos() {
        String email = nuevoDueno(mascota("Rex", "Perro"));
        DuenoRepo.INSTANCE.entrar("");
        assertNull(DuenoRepo.INSTANCE.buscarMascota("Rex"));
        DuenoRepo.INSTANCE.entrar(email);
        assertNotNull(DuenoRepo.INSTANCE.buscarMascota("Rex"));
        assertNull(DuenoRepo.INSTANCE.buscarMascota("Koda"));
    }

    @Test
    public void agendarUnEventoLoGuardaYAvisa() {
        nuevoDueno(mascota("Rex", "Perro"));
        LocalDate fecha = LocalDate.now().plusDays(3);
        DuenoRepo.INSTANCE.agendarEvento(fecha, "Control", "Rex", "", "10:00", "Revisión");

        assertEquals(1, DuenoRepo.INSTANCE.getEventos().size());
        assertEquals(1, DuenoRepo.INSTANCE.eventosDelDia(fecha).size());
        assertTrue(DuenoRepo.INSTANCE.getHayNotificacionesSinLeer());
        assertEquals(TipoNotificacion.TURNO, DuenoRepo.INSTANCE.getNotificaciones().get(0).getTipo());
    }

    @Test
    public void agendarConUnVeterinarioLeDaAccesoALaMascota() {
        nuevoDueno(mascota("Rex", "Perro"));
        DuenoRepo.INSTANCE.agendarEvento(LocalDate.now().plusDays(2), "Vacuna", "Rex",
                "Dr. Alejandro Ramírez", "11:00", "");

        VeterinarioAcceso vet = DuenoRepo.INSTANCE.buscarVeterinario("Dr. Alejandro Ramírez");
        assertNotNull(vet);
        assertEquals(EstadoAcceso.ACTIVO, vet.getEstado());
        assertTrue(vet.getMascotas().contains("Rex"));
        assertTrue(DuenoRepo.INSTANCE.getAutorizados().contains(vet));
        assertTrue(DuenoRepo.INSTANCE.tieneTurnoCon("Dr. Alejandro Ramírez", "Rex"));
    }

    @Test
    public void noSePuedeAgendarDosVecesLaMismaMascotaALaMismaHora() {
        nuevoDueno(mascota("Rex", "Perro"));
        LocalDate fecha = LocalDate.now().plusDays(1);
        assertFalse(DuenoRepo.INSTANCE.hayConflictoDeTurno(fecha, "10:00", "Rex"));
        DuenoRepo.INSTANCE.agendarEvento(fecha, "Control", "Rex", "", "10:00", "");
        assertTrue(DuenoRepo.INSTANCE.hayConflictoDeTurno(fecha, "10:00", "Rex"));
        assertFalse(DuenoRepo.INSTANCE.hayConflictoDeTurno(fecha, "11:00", "Rex"));
    }

    @Test
    public void cancelarUnEventoLoQuitaYDejaUnAviso() {
        nuevoDueno(mascota("Rex", "Perro"));
        DuenoRepo.INSTANCE.agendarEvento(LocalDate.now().plusDays(5), "Control", "Rex", "", "09:00", "");
        EventoMascota evento = DuenoRepo.INSTANCE.getEventos().get(0);
        DuenoRepo.INSTANCE.cancelarEvento(evento, false);

        assertTrue(DuenoRepo.INSTANCE.getEventos().isEmpty());
        assertEquals(TipoNotificacion.CANCELACION, DuenoRepo.INSTANCE.getNotificaciones().get(0).getTipo());
    }

    @Test
    public void modificarUnEventoCambiaFechaYHora() {
        nuevoDueno(mascota("Rex", "Perro"));
        DuenoRepo.INSTANCE.agendarEvento(LocalDate.now().plusDays(5), "Control", "Rex", "", "09:00", "");
        EventoMascota evento = DuenoRepo.INSTANCE.getEventos().get(0);
        LocalDate nueva = LocalDate.now().plusDays(8);
        DuenoRepo.INSTANCE.modificarEvento(evento, nueva, "16:00", "", "Cambio");

        assertEquals(nueva, evento.getFecha());
        assertEquals("16:00", evento.getHora());
        assertEquals("Cambio", evento.getObservaciones());
    }

    @Test
    public void darDeBajaUnaMascotaLaQuitaDeLaLista() {
        nuevoDueno(mascota("Rex", "Perro"), mascota("Michi", "Gato"));
        Mascota rex = DuenoRepo.INSTANCE.buscarMascota("Rex");
        DuenoRepo.INSTANCE.darDeBajaMascota(rex);

        assertNull(DuenoRepo.INSTANCE.buscarMascota("Rex"));
        assertEquals(1, DuenoRepo.INSTANCE.getMascotas().size());
        assertEquals(TipoNotificacion.MASCOTA, DuenoRepo.INSTANCE.getNotificaciones().get(0).getTipo());
    }

    @Test
    public void losEventosSeSeparanEntreProximosYPasados() {
        nuevoDueno(mascota("Rex", "Perro"));
        DuenoRepo.INSTANCE.getEventos().add(
                new EventoMascota("Control", "Rex", "", "10:00", "", LocalDate.now().plusDays(4)));
        DuenoRepo.INSTANCE.getEventos().add(
                new EventoMascota("Vacuna", "Rex", "", "10:00", "", LocalDate.now().minusDays(4)));

        assertEquals(1, DuenoRepo.INSTANCE.eventosOrdenados(true, null).size());
        assertEquals(1, DuenoRepo.INSTANCE.eventosOrdenados(false, null).size());
        assertEquals(1, DuenoRepo.INSTANCE.actividadReciente().size());
        assertNotNull(DuenoRepo.INSTANCE.proximoEvento("Rex"));
    }

    @Test
    public void laVacunaPendienteSoloCuentaDentroDeLos30Dias() {
        nuevoDueno(mascota("Rex", "Perro"));
        assertFalse(DuenoRepo.INSTANCE.tieneVacunaPendiente("Rex"));
        DuenoRepo.INSTANCE.getEventos().add(
                new EventoMascota("Vacuna", "Rex", "", "10:00", "", LocalDate.now().plusDays(40)));
        assertFalse(DuenoRepo.INSTANCE.tieneVacunaPendiente("Rex"));
        DuenoRepo.INSTANCE.getEventos().add(
                new EventoMascota("Vacuna", "Rex", "", "10:00", "", LocalDate.now().plusDays(10)));
        assertTrue(DuenoRepo.INSTANCE.tieneVacunaPendiente("Rex"));
    }

    @Test
    public void soloLasHorasDeHoyPuedenHaberPasado() {
        assertFalse(DuenoRepo.INSTANCE.horaPasada(LocalDate.now().plusDays(1), "00:00"));
        assertFalse(DuenoRepo.INSTANCE.horaPasada(LocalDate.now().minusDays(1), "23:00"));
        assertEquals("10:00", DuenoRepo.INSTANCE.horaValidaPara(LocalDate.now().plusDays(1), "10:00"));
    }

    @Test
    public void autorizarUnVeterinarioDelCatalogoLoPasaALosAutorizados() {
        nuevoDueno(mascota("Rex", "Perro"));
        List<VeterinarioAcceso> candidatos = DuenoRepo.INSTANCE.candidatosAAutorizar("ramírez");
        assertEquals(1, candidatos.size());
        DuenoRepo.INSTANCE.autorizarVeterinario(candidatos.get(0));

        assertEquals(1, DuenoRepo.INSTANCE.getAutorizados().size());
        assertTrue(DuenoRepo.INSTANCE.candidatosAAutorizar("ramírez").isEmpty());
        DuenoRepo.INSTANCE.revocarAcceso(DuenoRepo.INSTANCE.getAutorizados().get(0));
        assertEquals(EstadoAcceso.INACTIVO, DuenoRepo.INSTANCE.getAutorizados().get(0).getEstado());
        DuenoRepo.INSTANCE.restablecerAcceso(DuenoRepo.INSTANCE.getAutorizados().get(0));
        assertTrue(DuenoRepo.INSTANCE.getAutorizados().get(0).getTieneAcceso());
    }

    @Test
    public void lasContrasenasSeValidanPorCuenta() {
        String email = nuevoDueno(mascota("Rex", "Perro"));
        assertFalse(CuentasRepo.INSTANCE.passwordIncorrecta(email, "123456"));
        assertTrue(CuentasRepo.INSTANCE.passwordIncorrecta(email, "otra-clave"));
        assertFalse(CuentasRepo.INSTANCE.passwordIncorrecta("nadie@test.com", "cualquiera"));
        assertEquals(CuentasRepo.Rol.DUENO, CuentasRepo.INSTANCE.rolDe(email));
        CuentasRepo.INSTANCE.cambiarPassword(email, "nueva123");
        assertFalse(CuentasRepo.INSTANCE.passwordIncorrecta(email, "nueva123"));
    }

    @Test
    public void lasNotificacionesSeMarcanComoLeidasYSeLimpian() {
        nuevoDueno(mascota("Rex", "Perro"));
        DuenoRepo.INSTANCE.notificar(TipoNotificacion.ACCESO, "Título", "Mensaje");
        assertTrue(DuenoRepo.INSTANCE.getHayNotificacionesSinLeer());
        DuenoRepo.INSTANCE.marcarNotificacionesLeidas();
        assertFalse(DuenoRepo.INSTANCE.getHayNotificacionesSinLeer());
        DuenoRepo.INSTANCE.limpiarNotificaciones();
        assertTrue(DuenoRepo.INSTANCE.getNotificaciones().isEmpty());
    }

    @Test
    public void lasFechasEscritasSeInterpretan() {
        assertEquals(LocalDate.of(2020, 3, 15), Fechas.INSTANCE.parsear("15 Mar 2020"));
        assertEquals(LocalDate.of(2020, 3, 15), Fechas.INSTANCE.parsear("15 mar 2020"));
        assertEquals(LocalDate.of(2020, 3, 15), Fechas.INSTANCE.parsear("15/03/2020"));
        assertNull(Fechas.INSTANCE.parsear("sin fecha"));
        assertNull(Fechas.INSTANCE.parsear(null));
        assertNull(Fechas.INSTANCE.parsear(""));
    }

    @Test
    public void laMascotaArmaSusTextos() {
        Mascota m = new Mascota("Koda", "Perro", "Golden Retriever", LocalDate.of(2020, 3, 15),
                Sexo.MACHO, null, 0, "28 kg", "1", "Dorado", "Nada");
        assertEquals("Perro - Golden Retriever", m.getTipoRazaTexto());
        assertEquals("Nacido el 15 Mar 2020 - Macho", m.getNacimientoSexoTexto());
        assertEquals("K", m.getInicial());
        assertTrue(m.getTienePesoValido());

        Mascota sinDatos = new Mascota("Mika", "Gato", "", null, null, null, 0, "Sin datos", "Sin datos", "Sin datos", "");
        assertEquals("Gato", sinDatos.getTipoRazaTexto());
        assertEquals("Fecha de nacimiento sin datos", sinDatos.getNacimientoSexoTexto());
        assertNull(sinDatos.edadTexto(LocalDate.now()));
        assertFalse(sinDatos.getTienePesoValido());
    }
}
