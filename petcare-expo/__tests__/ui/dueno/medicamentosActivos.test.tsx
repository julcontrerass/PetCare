/* Medicamentos activos del dueño: empezar con la primera dosis, ver la grilla y tildar una toma atrasada. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Reloj } from "../../../src/util/tiempo";
import { MedicamentosActivos } from "../../../src/ui/dueno/MedicamentosActivos";

const HOY = new Date(2026, 10, 24, 19, 0, 0); // 24/11/2026 19:00
let fuente: FuenteEnMemoria;

beforeEach(() => {
  Reloj.fijar(HOY);
  fuente = prepararServicios();
  fuente.mascotas.push(Escenario.mascota("m1", "Luna"));
  fuente.recetas.push({
    id: "r1", mascota_id: "m1", medicamento: "Amoxicilina", dosis: "250 mg", frecuencia_horas: 24, duracion_dias: 3,
    inicio: "2026-11-24", created_at: new Date(2026, 10, 24, 11, 0, 0).toISOString(), con_comida: "despues",
  });
});
afterEach(() => {
  Reloj.fijar(null);
  limpiarServicios();
});

test("sin empezar: muestra cuántas tomas son y arranca con la primera dosis", async () => {
  await ingresarComoDueno();
  await render(<MedicamentosActivos />);
  expect(screen.getByText("Medicamentos activos")).toBeTruthy();
  expect(screen.getByText("Sin empezar")).toBeTruthy();
  expect(screen.getByText("Después de comer")).toBeTruthy();
  await fireEvent.press(screen.getByText("Ya le di la primera dosis"));
  await fireEvent.press(screen.getByText("Ahora (19:00)"));
  expect(fuente.llamadas).toContain("empezarTratamiento:r1:2026-11-24T19:00:00");
  // Ya en curso: la primera toma tildada y las de los días siguientes a la misma hora
  expect(await screen.findByText("En curso")).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "19:00, dada" })).toBeTruthy();
  expect(screen.getAllByLabelText("19:00, más adelante")).toHaveLength(2);
});

test("una toma atrasada pregunta si se dio a horario o recién", async () => {
  fuente.recetas[0].empezo_at = "2026-11-23T08:00:00";
  await ingresarComoDueno();
  await render(<MedicamentosActivos />);
  // La del 23 se dio (no se tildó) y la de hoy a las 8 tampoco: las dos están atrasadas
  const atrasadas = screen.getAllByRole("checkbox", { name: "08:00, no se dio" });
  expect(atrasadas).toHaveLength(2);
  await fireEvent.press(atrasadas[1]);
  await fireEvent.press(screen.getByText("A horario (08:00)"));
  await new Promise((r) => setTimeout(r, 0));
  expect(fuente.llamadas.some((l) => l.startsWith("registrarToma:r1:2026-11-24T08:00:00@"))).toBe(true);
});

test("suspendido: no se puede tildar y muestra el motivo", async () => {
  fuente.recetas[0].empezo_at = "2026-11-24T08:00:00";
  fuente.recetas[0].suspendida_at = new Date(2026, 10, 24, 12, 0, 0).toISOString();
  fuente.recetas[0].motivo_suspension = "Cambiamos de antibiótico";
  await ingresarComoDueno();
  await render(<MedicamentosActivos />);
  expect(screen.getByText("Suspendido")).toBeTruthy();
  expect(screen.getByText("El veterinario suspendió el tratamiento: Cambiamos de antibiótico")).toBeTruthy();
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
});
