/* Migrado de app/src/test/.../RegistroTest.kt. */
import { crearDatosRegistroVeterinario } from "../../src/data/datosRegistro";
import { Registro } from "../../src/data/registro";
import { crearSede } from "../../src/model/modelos";
import type { FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { limpiarServicios, prepararServicios } from "../soporte/pruebaBase";

let fuente: FuenteEnMemoria;

beforeEach(() => {
  fuente = prepararServicios();
});

afterEach(() => {
  limpiarServicios();
});

const datos = (matricula: string, extra: Parameters<typeof crearDatosRegistroVeterinario>[0] extends infer T ? Partial<T> : never = {}) =>
  crearDatosRegistroVeterinario({
    nombre: "Dra. Vera", dni: "28999888", telefono: "1155550000", email: "vera@prueba.test",
    password: "123456", matricula, clinica: "Clínica Sur", direccionClinica: "Av. Siempreviva 742",
    especialidades: ["Chequeo médico integral"], tiposAnimales: ["Perro"], dias: [1, 2, 3],
    apertura: "09:00", cierre: "18:00",
    ...extra,
  });

test("veterinario_conMatriculaLibreSeRegistra", async () => {
  await Registro.veterinario(datos("MP-500"));

  expect(fuente.llamadas).toContain("registrar:vera@prueba.test");
});

test("veterinario_conMatriculaEnUsoNoLlegaAlServidor", async () => {
  fuente.matriculasEnUso.add("mp-500");

  const error = await Registro.veterinario(datos("MP-500")).then(
    () => null,
    (e: Error) => e,
  );

  expect(error?.message).toBe("Esa matrícula ya está registrada con otra cuenta");
  expect(fuente.llamadas.filter((l) => l.startsWith("registrar:"))).toHaveLength(0);
});

test("veterinario_mandaLosLugaresExtraAlServidor", async () => {
  const extra = crearSede({ id: "", nombre: "Consultorio Centro", direccion: "San Martín 100", dias: [6, 4], apertura: "10:00", cierre: "14:00" });

  await Registro.veterinario(datos("MP-501", { sedesExtra: [extra] }));

  const enviados = fuente.ultimosDatosDeRegistro!;
  const sedes = enviados["sedes"] as unknown as Record<string, unknown>[];
  expect(sedes).toHaveLength(1);
  const primera = sedes[0];
  expect(primera["nombre"]).toBe("Consultorio Centro");
  expect(primera["direccion"]).toBe("San Martín 100");
  expect(JSON.stringify(primera["dias_atencion"])).toBe("[4,6]");
  expect(primera["hora_apertura"]).toBe("10:00");
  // El primer lugar sigue siendo la clínica "de siempre"
  expect(enviados["clinica"]).toBe("Clínica Sur");
});

test("veterinario_sinLugaresExtraManda_unaListaVacia", async () => {
  await Registro.veterinario(datos("MP-502"));

  expect(fuente.ultimosDatosDeRegistro!["sedes"] as unknown[]).toHaveLength(0);
});
