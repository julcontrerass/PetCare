package frgp.utn.edu.petcare;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.List;

public class RepositoriosTest {

    @Test
    public void pacientes_filtraPorEspecie() {
        List<Paciente> gatos = PacientesRepo.INSTANCE.filtrar("", PacientesRepo.ESPECIE_GATO);
        assertEquals(2, gatos.size());
        for (Paciente p : gatos) assertEquals(PacientesRepo.ESPECIE_GATO, p.getEspecie());
    }

    @Test
    public void pacientes_buscaPorNombreRazaYPropietario() {
        assertEquals(1, PacientesRepo.INSTANCE.filtrar("koda", null).size());
        assertEquals(1, PacientesRepo.INSTANCE.filtrar("maine", null).size());
        assertEquals(2, PacientesRepo.INSTANCE.filtrar("julieta", null).size());
        assertTrue(PacientesRepo.INSTANCE.filtrar("zzz", null).isEmpty());
    }

    @Test
    public void pacientes_idDesconocidoDevuelveElPrimero() {
        assertEquals(PacientesRepo.INSTANCE.getPacientes().get(0), PacientesRepo.INSTANCE.porId(-1));
        assertEquals("Luna", PacientesRepo.INSTANCE.porId(4).getNombre());
    }

    @Test
    public void salud_filtraPorTipoMascotaYTexto() {
        List<RegistroSalud> vacunasKoda = SaludRepo.INSTANCE.filtrar(TipoRegistro.VACUNA, "", "Koda");
        assertEquals(2, vacunasKoda.size());
        assertEquals(1, SaludRepo.INSTANCE.filtrar(TipoRegistro.TRATAMIENTO, "levo", null).size());
        assertTrue(SaludRepo.INSTANCE.filtrar(TipoRegistro.DOCUMENTO, "", "Milo").isEmpty());
    }
}
