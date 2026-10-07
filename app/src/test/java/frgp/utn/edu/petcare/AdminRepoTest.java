package frgp.utn.edu.petcare;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AdminRepoTest {

    private VetAdminItem nuevoVet(String email) {
        AdminRepo.INSTANCE.registrarNuevoVet("Dra. Test Prueba", email, "MP-1", "Clínica Test",
                "Calle 1", "1100000000", "Control general", "Lun a Vie · 09:00 a 18:00 hs", "30111222", null);
        return AdminRepo.INSTANCE.getListaVeterinarios().get(0);
    }

    @Test
    public void veterinarioNuevoQuedaEnRevisionYNoPuedeIngresar() {
        VetAdminItem vet = nuevoVet("revision@test.com");
        assertEquals(AdminRepo.PENDIENTE, vet.getEstado());
        assertNotNull(AdminRepo.INSTANCE.motivoBloqueo("revision@test.com"));
        assertTrue(AdminRepo.INSTANCE.pendientesRevisionCount() > 0);
    }

    @Test
    public void altaDejaIngresarYQuedaEnLaActividad() {
        VetAdminItem vet = nuevoVet("alta@test.com");
        int antes = AdminRepo.INSTANCE.getActividad().size();
        AdminRepo.INSTANCE.aprobarVet(vet.getId());
        assertEquals(AdminRepo.ACTIVO, vet.getEstado());
        assertNull(AdminRepo.INSTANCE.motivoBloqueo("alta@test.com"));
        assertEquals(antes + 1, AdminRepo.INSTANCE.getActividad().size());
        assertEquals(TipoActividad.APROBACION, AdminRepo.INSTANCE.getActividad().get(0).getTipo());
    }

    @Test
    public void rechazoGuardaElMotivoYSeLoMuestraAlVeterinario() {
        VetAdminItem vet = nuevoVet("rechazo@test.com");
        AdminRepo.INSTANCE.rechazarVet(vet.getId(), "Matrícula inválida");
        assertEquals(AdminRepo.RECHAZADO, vet.getEstado());
        String mensaje = AdminRepo.INSTANCE.motivoBloqueo("rechazo@test.com");
        assertNotNull(mensaje);
        assertTrue(mensaje.contains("Matrícula inválida"));
    }

    @Test
    public void suspenderYReactivarVeterinario() {
        VetAdminItem vet = nuevoVet("suspension@test.com");
        AdminRepo.INSTANCE.aprobarVet(vet.getId());
        AdminRepo.INSTANCE.suspenderVet(vet.getId(), "Matrícula vencida");
        assertEquals(AdminRepo.SUSPENDIDO, vet.getEstado());
        assertNotNull(AdminRepo.INSTANCE.motivoBloqueo("suspension@test.com"));
        AdminRepo.INSTANCE.reactivarVet(vet.getId());
        assertEquals(AdminRepo.ACTIVO, vet.getEstado());
        assertNull(AdminRepo.INSTANCE.motivoBloqueo("suspension@test.com"));
    }

    @Test
    public void suspenderYReactivarDueno() {
        AdminRepo.INSTANCE.registrarNuevoDueno("Dueño Test", "30999888", "dueno@test.com", "1100000000",
                "Calle 2", java.util.Arrays.asList("Rex (Perro)", "Sin mascotas por ahora"), null);
        DuenoAdminItem dueno = AdminRepo.INSTANCE.getListaDuenos().get(0);
        assertNull(AdminRepo.INSTANCE.motivoBloqueo("dueno@test.com"));
        AdminRepo.INSTANCE.suspenderDueno(dueno.getId(), "Datos falsos");
        assertEquals(AdminRepo.SUSPENDIDO, dueno.getEstado());
        assertNotNull(AdminRepo.INSTANCE.motivoBloqueo("dueno@test.com"));
        AdminRepo.INSTANCE.reactivarDueno(dueno.getId());
        assertNull(AdminRepo.INSTANCE.motivoBloqueo("dueno@test.com"));
    }

    @Test
    public void lasInicialesIgnoranElTitulo() {
        assertEquals("JP", AdminRepo.INSTANCE.iniciales("Dr. Juan Pérez"));
        assertEquals("LS", AdminRepo.INSTANCE.iniciales("Dra. Laura Sosa"));
        assertEquals("A", AdminRepo.INSTANCE.iniciales("Ana"));
    }

    @Test
    public void lasMascotasSinCargarNoSeCuentan() {
        int antes = AdminRepo.INSTANCE.totalMascotas();
        AdminRepo.INSTANCE.registrarNuevoDueno("Sin Mascotas", "30888777", "sinmascotas@test.com", "1100000000",
                "Calle 3", java.util.Arrays.asList("Sin mascotas por ahora"), null);
        assertEquals(antes, AdminRepo.INSTANCE.totalMascotas());
    }
}
