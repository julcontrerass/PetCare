/*
 * Escenario compartido de las pruebas del veterinario (de PantallasTest.cargarEscenario): Rex (m1) y Mia (m2, gato) con
 * acceso, y los turnos t1 (hoy 10:00), t2 (en 2 días, 11:00) y t3 (completado hace 20 días).
 * (Reconstruido: la versión original fue pisada por error al escribir las pruebas de la parte B.)
 */
import { LocalDate } from "../../../src/util/tiempo";
import { accesoDto, Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";

export const hoy = LocalDate.now();

export function cargarEscenarioVet(servidor: FuenteEnMemoria): void {
  const dia = LocalDate.now();
  servidor.perfiles.push(Escenario.dueno(), Escenario.veterinario());
  servidor.mascotas.push(Escenario.mascota("m1", "Rex"), Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  servidor.accesosGuardados.push(
    accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"),
    accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"),
  );
  servidor.turnosGuardados.push(
    Escenario.turno("t1", "m1", dia.toString(), "10:00:00"),
    Escenario.turno("t2", "m2", dia.plusDays(2).toString(), "11:00:00"),
    Escenario.turno("t3", "m1", dia.minusDays(20).toString(), "09:00:00", Escenario.VET_ID, "completado"),
  );
}
