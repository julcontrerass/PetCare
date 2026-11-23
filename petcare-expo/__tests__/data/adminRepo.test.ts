/* Migrado de app/src/test/.../AdminRepoTest.kt. */
import { AdminRepo } from "../../src/data/repositorio/adminRepo";
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { asentar } from "../soporte/asentar";
import { ingresarComo, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";

let fuente: FuenteEnMemoria;

beforeEach(async () => {
  fuente = prepararServicios();
  fuente.perfiles.push(Escenario.veterinario("vet-1", "Dr. Activo"));
  fuente.perfiles.push(Escenario.veterinario("vet-2", "Dra. Nueva", "pendiente_revision"));
  fuente.perfiles.push(Escenario.veterinario("vet-3", "Dr. Suspendido", "suspendido"));
  fuente.perfiles.push(Escenario.dueno());
  fuente.mascotas.push(Escenario.mascota("m1", "Rex"));
  fuente.mascotas.push(Escenario.mascota("m2", "Mia"));
  fuente.actividad.push({ id: "x1", tipo: "registro", texto: "Dra. Nueva pidió el alta", created_at: "2026-01-02T10:00:00+00:00" });
  fuente.actividad.push({ id: "x2", tipo: "baja", texto: "Alguien eliminó su cuenta", created_at: "2026-01-01T10:00:00+00:00" });
  fuente.resumen = Escenario.resumen({ mascotas: 2, turnos_hoy: 3 });
  await ingresarComo(Escenario.admin());
});

afterEach(() => {
  limpiarServicios();
});

test("cargar_armaVeterinariosDuenosYActividad", () => {
  expect(AdminRepo.listaVeterinarios).toHaveLength(3);
  expect(AdminRepo.listaDuenos).toHaveLength(1);
  expect(AdminRepo.listaDuenos[0].mascotas).toEqual(["Rex (Mestizo)", "Mia (Mestizo)"]);
  expect(AdminRepo.listaDuenos[0].dni).toBe("30111222");
  expect(AdminRepo.actividad).toHaveLength(2);
  expect(AdminRepo.actividad[0].tipo).toBe("REGISTRO");
  expect(AdminRepo.actividad[1].tipo).toBe("BAJA");
});

test("contadores_salenDeLasCuentasYDelResumen", () => {
  expect(AdminRepo.vetsActivos()).toBe(1);
  expect(AdminRepo.pendientesRevisionCount()).toBe(1);
  expect(AdminRepo.duenosActivos()).toBe(1);
  expect(AdminRepo.totalMascotas()).toBe(2);
  expect(AdminRepo.turnosHoy()).toBe(3);
});

test("veterinario_muestraHorariosYEspecialidades", () => {
  const vet = AdminRepo.vetPorId("vet-1")!;
  expect(vet.diasYHorarios).toBe("Lun a Vie · 09:00 a 12:00 hs");
  expect(vet.especialidades).toBe("Chequeo médico integral, Cardiología");
  expect(vet.matricula).toBe("MP-100");
  expect(vet.estado).toBe(AdminRepo.ACTIVO);
});

test("aprobarVet_cambiaElEstadoEnElServidor", async () => {
  AdminRepo.aprobarVet("vet-2");
  await asentar();

  expect(AdminRepo.vetPorId("vet-2")!.estado).toBe(AdminRepo.ACTIVO);
  expect(fuente.llamadas).toContain("revisionVet:vet-2=activo");
  expect(AdminRepo.vetsActivos()).toBe(2);
});

test("rechazarYSuspender_mandanElMotivo", async () => {
  AdminRepo.rechazarVet("vet-2", "Matrícula no verificada");
  AdminRepo.suspenderDueno(Escenario.DUENO_ID, "Maltrato");
  await asentar();

  expect(fuente.llamadas).toContain("revisionVet:vet-2=rechazado:Matrícula no verificada");
  expect(fuente.llamadas).toContain(`estadoCuenta:${Escenario.DUENO_ID}=suspendido:Maltrato`);
  expect(AdminRepo.duenoPorId(Escenario.DUENO_ID)!.estado).toBe(AdminRepo.SUSPENDIDO);
  expect(AdminRepo.duenoPorId(Escenario.DUENO_ID)!.motivo).toBe("Maltrato");
});

test("reactivar_vuelveAActivoYBorraElMotivo", async () => {
  AdminRepo.reactivarVet("vet-3");
  await asentar();

  const vet = AdminRepo.vetPorId("vet-3")!;
  expect(vet.estado).toBe(AdminRepo.ACTIVO);
  expect(vet.motivo).toBe("");
  expect(fuente.llamadas).toContain("revisionVet:vet-3=activo");
});

test("duenoConRolDeVeterinario_apareceEnAmbasListasYSeRevisaSoloElRol", async () => {
  // La cuenta de dueño de Ana sigue activa: lo que se revisa es su rol de veterinaria
  fuente.perfiles = fuente.perfiles.filter((p) => p.id !== Escenario.DUENO_ID);
  fuente.perfiles.push(Escenario.duenoYVeterinario("pendiente_revision"));
  await AdminRepo.cargar();

  const vet = AdminRepo.vetPorId(Escenario.DUENO_ID)!;
  expect(vet.estado).toBe(AdminRepo.PENDIENTE);
  expect(vet.tambienEsDueno).toBe(true);
  expect(vet.credencialPath).toBe(`${Escenario.DUENO_ID}/carnet.jpg`);
  expect(AdminRepo.duenoPorId(Escenario.DUENO_ID)!.estado).toBe(AdminRepo.ACTIVO);

  AdminRepo.aprobarVet(Escenario.DUENO_ID);
  await asentar();

  expect(fuente.llamadas).toContain(`revisionVet:${Escenario.DUENO_ID}=activo`);
  expect(AdminRepo.vetPorId(Escenario.DUENO_ID)!.estado).toBe(AdminRepo.ACTIVO);
  expect(AdminRepo.duenoPorId(Escenario.DUENO_ID)!.estado).toBe(AdminRepo.ACTIVO);
});

test("iniciales_ignoranElTitulo", () => {
  expect(AdminRepo.iniciales("Dr. Juan Pérez")).toBe("JP");
  expect(AdminRepo.iniciales("Laura")).toBe("L");
  expect(AdminRepo.iniciales("")).toBe("?");
});
