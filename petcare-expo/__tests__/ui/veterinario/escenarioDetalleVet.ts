/* Escenario de las pruebas de las pantallas de detalle del veterinario (parte B). */
import { Reloj, LocalDate } from "../../../src/util/tiempo";
import { accesoDto, Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComoVeterinario } from "../../soporte/pruebaBase";

/** Lunes 23/11/2026 a las 8:00: el veterinario del escenario atiende de lunes a viernes de 9 a 12. */
export function fijarHoy(): void {
  Reloj.fijar(new Date(2026, 10, 23, 8, 0, 0));
}

export function liberarHoy(): void {
  Reloj.fijar(null);
}

/** Rex (m1) y Mia (m2, gato) con acceso; turnos t1 (hoy 10:00), t2 (en 2 días) y t3 (completado hace 20 días). */
export async function entrarComoVeterinario(servidor: FuenteEnMemoria): Promise<void> {
  const hoy = LocalDate.now();
  servidor.mascotas.push(Escenario.mascota("m1", "Rex"), Escenario.mascota("m2", "Mia", Escenario.DUENO_ID, "Gato"));
  servidor.accesosGuardados.push(
    accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"),
    accesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"),
  );
  servidor.turnosGuardados.push(
    Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"),
    Escenario.turno("t2", "m2", hoy.plusDays(2).toString(), "11:00:00"),
    Escenario.turno("t3", "m1", hoy.minusDays(20).toString(), "09:00:00", Escenario.VET_ID, "completado"),
  );
  await ingresarComoVeterinario();
}
