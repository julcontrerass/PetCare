/* "Es hora" en el Inicio del dueño: aparece solo cuando toca una toma o hay que empezar un tratamiento. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { AhoraMedicacion, tomasQueTocan } from "../../../src/ui/dueno/AhoraMedicacion";
import { LocalDateTime, Reloj } from "../../../src/util/tiempo";

let fuente: FuenteEnMemoria;

/** Amoxicilina cada 8 hs durante 2 días; la primera dosis fue el 24/11 a las 8 (tomas a las 8, 16 y 0). */
function prepararReceta(empezoAt: string | null = "2026-11-24T08:00:00") {
  fuente.mascotas.push(Escenario.mascota("m1", "Luna"));
  fuente.recetas.push({
    id: "r1", mascota_id: "m1", medicamento: "Amoxicilina", dosis: "250 mg", frecuencia_horas: 8, duracion_dias: 2,
    inicio: "2026-11-24", created_at: new Date(2026, 10, 24, 7, 30, 0).toISOString(), empezo_at: empezoAt, con_comida: "despues",
  });
}

function a(hora: number, minuto = 0) {
  Reloj.fijar(new Date(2026, 10, 24, hora, minuto, 0));
}

beforeEach(() => {
  fuente = prepararServicios();
});
afterEach(() => {
  Reloj.fijar(null);
  limpiarServicios();
});

describe("Es hora de un remedio", () => {
  it("no aparece si no toca nada", async () => {
    a(9, 0);
    prepararReceta();
    fuente.tomasGuardadas.push({ id: "t1", prescripcion_id: "r1", mascota_id: "m1", programada: "2026-11-24 08:00:00", dada_at: "2026-11-24T11:00:00Z" });
    await ingresarComoDueno();
    await render(<AhoraMedicacion />);
    expect(screen.queryByText(/Es hora/)).toBeNull();
    expect(tomasQueTocan()).toHaveLength(0);
  });

  it("aparece 15 minutos antes y se marca con un toque", async () => {
    a(15, 50);
    prepararReceta();
    fuente.tomasGuardadas.push({ id: "t1", prescripcion_id: "r1", mascota_id: "m1", programada: "2026-11-24 08:00:00", dada_at: "2026-11-24T11:00:00Z" });
    await ingresarComoDueno();
    await render(<AhoraMedicacion />);
    expect(screen.getByText("Es hora de un remedio")).toBeTruthy();
    expect(screen.getByText("Amoxicilina 250 mg para Luna")).toBeTruthy();
    expect(screen.getByText("A las 16:00")).toBeTruthy();
    expect(screen.getByText("Después de comer")).toBeTruthy();

    await fireEvent.press(screen.getByText("Ya se la di"));
    expect(fuente.llamadas.some((l) => l.startsWith("registrarToma:r1:2026-11-24T16:00:00"))).toBe(true);
    expect(tomasQueTocan(LocalDateTime.now())).toHaveLength(0);
  });

  it("una atrasada pregunta si se dio a horario o recién", async () => {
    a(12, 0);
    prepararReceta();
    await ingresarComoDueno();
    await render(<AhoraMedicacion />);
    expect(screen.getByText("Era a las 08:00")).toBeTruthy();

    await fireEvent.press(screen.getByText("Ya se la di"));
    expect(screen.getByText("Toma de las 08:00")).toBeTruthy();
    await fireEvent.press(screen.getByText("A horario (08:00)"));
    expect(fuente.llamadas.some((l) => l.startsWith("registrarToma:r1:2026-11-24T08:00:00"))).toBe(true);
  });

  it("un tratamiento nuevo sin empezar pide la primera dosis", async () => {
    a(10, 0);
    prepararReceta(null);
    await ingresarComoDueno();
    await render(<AhoraMedicacion />);
    expect(screen.getByText("Empezá el tratamiento")).toBeTruthy();
    await fireEvent.press(screen.getByText("Le di la primera dosis"));
    expect(screen.getByText("Primera dosis de Amoxicilina")).toBeTruthy();
  });
});
