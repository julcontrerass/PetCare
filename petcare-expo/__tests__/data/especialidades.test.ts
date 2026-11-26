/*
 * Títulos de especialidades: el veterinario manda el título de cada especialidad, el administrador lo aprueba o lo
 * rechaza, y recién aprobada se les ofrece a los dueños. Los servicios generales se ofrecen siempre.
 */
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, ingresarComoDueno, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { CatalogoMedico } from "../../src/data/catalogoMedico";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { EspecialidadesRepo } from "../../src/data/repositorio/especialidadesRepo";
import { Sesion } from "../../src/data/sesion";

// Los archivos "se suben" sin leerlos: queda la ruta en la carpeta de quien los sube
jest.mock("../../src/data/habilitaciones", () => ({
  ...jest.requireActual("../../src/data/habilitaciones"),
  subirDocumentoPrivado: jest.fn(async (a: { nombre: string }, usuario: string, prefijo: string) => `${usuario}/${prefijo}-${a.nombre}`),
}));

const VET = Escenario.veterinario();
let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
  fuente.perfiles.push(VET);
});
afterEach(() => limpiarServicios());

async function cambiarA(perfil: typeof VET) {
  Sesion.olvidar();
  await ingresarComo(perfil);
}

const TITULO = {
  especialidad: "Cardiología", titulo: "Especialista en Cardiología", institucion: "UBA", anio: 2020,
  archivos: [{ uri: "file:///titulo.pdf", nombre: "titulo.pdf" }],
};

test("solo las especialidades piden título; los servicios se ofrecen siempre", () => {
  expect(CatalogoMedico.pideTitulo("Dermatología")).toBe(true);
  expect(CatalogoMedico.pideTitulo("Chequeo médico integral")).toBe(false);
  expect(CatalogoMedico.ofrecidas(["Chequeo médico integral", "Cardiología", "Dermatología"], ["Dermatología"]))
    .toEqual(["Chequeo médico integral", "Dermatología"]);
});

test("el veterinario manda el título, el administrador lo aprueba y desde ahí los dueños la ven", async () => {
  await ingresarComo(VET);
  await EspecialidadesRepo.cargar();
  expect(EspecialidadesRepo.lista.map((e) => [e.especialidad, e.estado])).toEqual([["Cardiología", "sin_certificado"]]);
  expect(EspecialidadesRepo.resumen()).toBe("1 sin título");

  await EspecialidadesRepo.enviar(TITULO);
  expect(fuente.llamadas).toContain("cargarCertificadoEspecialidad:Cardiología");
  expect(EspecialidadesRepo.lista[0].estado).toBe("pendiente");
  expect(EspecialidadesRepo.resumen()).toBe("1 en revisión");

  // Mientras está en revisión, el dueño no la ve
  await cambiarA(Escenario.dueno());
  expect(DuenoRepo.veterinariosPara("Cardiología")).toHaveLength(0);

  await cambiarA(Escenario.admin());
  const pendientes = await fuente.especialidadesParaRevisar();
  expect(pendientes.map((p) => [p.veterinario_nombre, p.especialidad, p.titulo, p.archivos.length])).toEqual([
    ["Dr. Vera", "Cardiología", "Especialista en Cardiología", 1],
  ]);
  await expect(fuente.revisarEspecialidad(pendientes[0].id, false, "")).rejects.toThrow("motivo");
  await fuente.revisarEspecialidad(pendientes[0].id, true, null);

  await cambiarA(Escenario.dueno());
  expect(DuenoRepo.veterinariosPara("Cardiología").map((v) => v.nombre)).toEqual(["Dr. Vera"]);
});

test("un título rechazado muestra el motivo y se puede volver a mandar", async () => {
  await ingresarComo(VET);
  await EspecialidadesRepo.enviar(TITULO);
  await cambiarA(Escenario.admin());
  const [p] = await fuente.especialidadesParaRevisar();
  await fuente.revisarEspecialidad(p.id, false, "El archivo no se lee");
  await cambiarA(VET);
  await EspecialidadesRepo.cargar();
  expect([EspecialidadesRepo.lista[0].estado, EspecialidadesRepo.lista[0].motivo]).toEqual(["rechazada", "El archivo no se lee"]);
  expect(EspecialidadesRepo.faltanTitulos).toBe(true);
  await EspecialidadesRepo.enviar(TITULO);
  expect(EspecialidadesRepo.lista[0].estado).toBe("pendiente");
});

test("no se manda el título de un servicio ni de una especialidad que no eligió", async () => {
  await ingresarComo(VET);
  await expect(EspecialidadesRepo.enviar({ ...TITULO, especialidad: "Chequeo médico integral" })).rejects.toThrow("no necesita");
  await expect(EspecialidadesRepo.enviar({ ...TITULO, especialidad: "Dermatología" })).rejects.toThrow("Primero elegí");
});
