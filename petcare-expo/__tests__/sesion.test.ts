/* Migrado de app/src/test/.../SesionTest.kt. */
import { Escenario, accesoDto, type FuenteEnMemoria } from "./soporte/fuenteEnMemoria";
import { ingresarComo, ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "./soporte/pruebaBase";
import { Sesion, type ResultadoBloqueada, type ResultadoListo } from "../src/data/sesion";
import { AdminRepo } from "../src/data/repositorio/adminRepo";
import { AgendaRepo } from "../src/data/repositorio/agendaRepo";
import { DuenoRepo } from "../src/data/repositorio/duenoRepo";
import { PacientesRepo } from "../src/data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../src/data/repositorio/perfilVetRepo";
import { LocalDate } from "../src/util/tiempo";

let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
});

afterEach(() => {
  limpiarServicios();
});

test("dueno_ingresaYSeCarganSusMascotas", async () => {
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.mascotas.push(Escenario.mascota("m2", "Ajeno", "otro"));

  const resultado = await ingresarComoDueno();

  expect(resultado.tipo).toBe("listo");
  expect((resultado as ResultadoListo).rol).toBe("DUENO");
  expect(DuenoRepo.mascotas.map((m) => m.nombre)).toEqual(["Rex"]);
  expect(DuenoRepo.perfil.nombre).toBe("Ana Prueba");
  expect(DuenoRepo.perfil.dni).toBe("30111222");
});

test("veterinarioActivo_cargaPacientesAgendaYPerfil", async () => {
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.accesosGuardados.push(accesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"));
  fuente.turnosGuardados.push(Escenario.turno("t1", "m1", LocalDate.now().toString(), "10:00:00"));

  const resultado = await ingresarComoVeterinario();

  expect((resultado as ResultadoListo).rol).toBe("VETERINARIO");
  expect(PerfilVetRepo.nombre).toBe("Dr. Vera");
  expect(PerfilVetRepo.matricula).toBe("MP-100");
  expect(PacientesRepo.pacientes.map((p) => p.nombre)).toEqual(["Rex"]);
  expect(AgendaRepo.eventos).toHaveLength(1);
  expect(AgendaRepo.eventos[0].hora).toBe("10:00");
  expect(PerfilVetRepo.diasSeleccionados[0]).toBe(true);
  expect(PerfilVetRepo.diasSeleccionados[5]).toBe(false);
  expect(PerfilVetRepo.horaCierre).toBe("12:00");
});

test("veterinarioEnRevision_noPuedeIngresar_yLaSesionSeCierra", async () => {
  const resultado = await ingresarComo(Escenario.veterinario(Escenario.VET_ID, "Dr. Vera", "pendiente_revision"));

  expect(resultado.tipo).toBe("bloqueada");
  expect((resultado as ResultadoBloqueada).mensaje).toContain("en revisión");
  expect(Sesion.activa).toBe(false);
  expect(fuente.sesionCerrada).toBe(true);
});

test("cuentaSuspendida_muestraElMotivo", async () => {
  const resultado = await ingresarComo(
    Escenario.perfil("d2", "dueno", "Beto", { estado: "suspendido", motivo: "Datos falsos" }),
  );

  expect((resultado as ResultadoBloqueada).mensaje).toContain("Datos falsos");
});

test("cuentaRechazada_avisaQueFueRechazada", async () => {
  const resultado = await ingresarComo(Escenario.veterinario(Escenario.VET_ID, "Dr. Vera", "rechazado"));

  expect((resultado as ResultadoBloqueada).mensaje).toContain("rechazó");
});

test("administrador_ingresaYCargaElPanel", async () => {
  fuente.perfiles.push(Escenario.veterinario());
  fuente.perfiles.push(Escenario.dueno());

  const resultado = await ingresarComo(Escenario.admin());

  expect((resultado as ResultadoListo).rol).toBe("ADMIN");
  expect(AdminRepo.listaVeterinarios).toHaveLength(1);
  expect(AdminRepo.listaDuenos).toHaveLength(1);
});

test("cerrar_descartaTodoLoQueHabiaEnMemoria", async () => {
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  await ingresarComoDueno();

  await Sesion.cerrar();

  expect(Sesion.activa).toBe(false);
  expect(DuenoRepo.mascotas).toHaveLength(0);
  expect(fuente.sesionCerrada).toBe(true);
});

test("restaurar_sinSesionGuardadaNoHaceNada", async () => {
  expect(await Sesion.restaurar()).toBeNull();
});

test("restaurar_conSesionGuardadaEntraDirecto", async () => {
  fuente.haySesionGuardada = true;

  const resultado = await Sesion.restaurar();

  expect(resultado?.tipo).toBe("listo");
  expect(Sesion.activa).toBe(true);
});

test("cerrarYVolver_esperaElCierreYAvisaAlIngreso", async () => {
  await ingresarComoDueno();
  const alVolver = jest.fn();
  Sesion.alVolverAlIngreso = alVolver;

  await Sesion.cerrarYVolver();

  expect(fuente.sesionCerrada).toBe(true);
  expect(alVolver).toHaveBeenCalledTimes(1);
  expect(Sesion.activa).toBe(false);
  Sesion.alVolverAlIngreso = null;
});
