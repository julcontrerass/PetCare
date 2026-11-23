/* Escenario común de las pruebas del veterinario (de PantallasTest.kt, `cargarEscenario`). */
import { LocalDate } from "../../../src/util/tiempo";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";

export const hoy = LocalDate.now();

/** Rex (turno hoy 10:00 y uno completado hace 20 días) y Mia, gata (turno en 2 días). */
export function cargarEscenarioVet(f: FuenteEnMemoria): void {
  f.mascotas.push(Escenario.mascota("m1", "Rex"), Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  f.accesosGuardados.push(
    accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"),
    accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"),
  );
  f.turnosGuardados.push(
    Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"),
    Escenario.turno("t2", "m2", hoy.plusDays(2).toString(), "11:00:00"),
    Escenario.turno("t3", "m1", hoy.minusDays(20).toString(), "09:00:00", Escenario.VET_ID, "completado"),
  );
}
