/* Migrado de app/src/test/.../ModosDeUsoTest.kt. */
import "../soporte/pruebaBase";
import { AgendaRepo } from "../../src/data/repositorio/agendaRepo";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { PerfilVetRepo } from "../../src/data/repositorio/perfilVetRepo";
import { Sesion, type ResultadoElegir, type ResultadoListo } from "../../src/data/sesion";
import { Escenario, accesoDto, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";

let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
});

afterEach(() => {
  limpiarServicios();
});

// Una cuenta puede ser dueño y veterinario: al ingresar se elige el modo y se puede cambiar sin cerrar sesión.

test("duenoSinRolDeVeterinario_entraDirectoComoDueno", async () => {
  const resultado = await ingresarComoDueno();

  expect(resultado.tipo).toBe("listo");
  expect((resultado as ResultadoListo).rol).toBe("DUENO");
  expect(Sesion.rolesDisponibles).toEqual(["DUENO"]);
});

test("duenoConRolDeVeterinarioAprobado_siempreElige", async () => {
  const resultado = await ingresarComo(Escenario.duenoYVeterinario());

  expect(resultado.tipo).toBe("elegir");
  expect((resultado as ResultadoElegir).roles).toEqual(["DUENO", "VETERINARIO"]);
  // Todavía no se cargó nada de ningún modo
  expect(Sesion.rol).toBeNull();
});

test("elegirVeterinario_cargaLaAgendaYElegirDuenoLasMascotas", async () => {
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.DUENO_ID, "activo", "dueno"));
  await ingresarComo(Escenario.duenoYVeterinario());

  const comoVet = await Sesion.entrarComo("VETERINARIO");
  expect(comoVet.rol).toBe("VETERINARIO");
  expect(PerfilVetRepo.matricula).toBe("MP-777");

  const comoDueno = await Sesion.cambiarModo("DUENO");
  expect(comoDueno.rol).toBe("DUENO");
  expect(DuenoRepo.mascotas.map((m) => m.nombre)).toEqual(["Rex"]);
  expect(AgendaRepo.eventos).toHaveLength(0);
});

test("rolDeVeterinarioPendiente_noOfreceElModoNiPregunta", async () => {
  const resultado = await ingresarComo(Escenario.duenoYVeterinario("pendiente_revision"));

  expect(resultado.tipo).toBe("listo");
  expect(Sesion.rolesDisponibles).toEqual(["DUENO"]);
  // En Kotlin era una IllegalArgumentException; acá es un Error común
  await expect(Sesion.cambiarModo("VETERINARIO")).rejects.toBeInstanceOf(Error);
});

test("veterinarioSinMascotas_entraDirectoPeroPuedePasarAlModoDueno", async () => {
  const resultado = await ingresarComoVeterinario();

  expect((resultado as ResultadoListo).rol).toBe("VETERINARIO");
  expect(Sesion.rolesDisponibles).toContain("DUENO");
});

test("veterinarioConMascotasPropias_eligeComoIngresar", async () => {
  fuente.mascotas.push(Escenario.mascota("m9", "Pipa", Escenario.VET_ID));
  const resultado = await ingresarComoVeterinario();

  expect(resultado.tipo).toBe("elegir");
});

test("cuentaEnRevision_siguePidiendoEsperar", async () => {
  const resultado = await ingresarComo(Escenario.veterinario(Escenario.VET_ID, "Dr. Vera", "pendiente_revision"));

  expect(resultado.tipo).toBe("bloqueada");
});
