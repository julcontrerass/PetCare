/* FichaClinica (alertas y peso), GraficoPesoView y VetUi. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { LocalDate } from "../../src/util/tiempo";
import { AlertasClinicas, EvolucionPeso } from "../../src/ui/common/FichaClinica";
import { geometriaPeso, GraficoPesoView, type PuntoPeso } from "../../src/ui/common/GraficoPesoView";

const puntos: PuntoPeso[] = [
  [LocalDate.of(2026, 3, 1), 10],
  [LocalDate.of(2026, 1, 1), 8.5],
  [LocalDate.of(2026, 5, 1), 12],
];

describe("AlertasClinicas", () => {
  it("sin alertas dice que no hay ninguna y ofrece agregarlas si se puede editar", async () => {
    const alEditar = jest.fn();
    await render(<AlertasClinicas texto="" alEditar={alEditar} />);
    expect(screen.getByText("Alertas clínicas: ninguna cargada")).toBeTruthy();
    await fireEvent.press(screen.getByText("Agregar alertas (alergias, carácter, condiciones)"));
    expect(alEditar).toHaveBeenCalledTimes(1);
  });

  it("con alertas las muestra y solo lee si no hay alEditar", async () => {
    await render(<AlertasClinicas texto="Alérgico a la penicilina" />);
    expect(screen.getByText("Alertas clínicas")).toBeTruthy();
    expect(screen.getByText("Alérgico a la penicilina")).toBeTruthy();
    expect(screen.queryByText("Editar alertas")).toBeNull();
  });
});

describe("EvolucionPeso", () => {
  it("no se dibuja con menos de dos mediciones", async () => {
    await render(<EvolucionPeso puntos={[puntos[0]]} />);
    expect(screen.queryByText("Evolución del peso")).toBeNull();
  });

  it("con dos o más mediciones muestra el título", async () => {
    await render(<EvolucionPeso puntos={puntos} />);
    expect(screen.getByText("Evolución del peso")).toBeTruthy();
  });
});

describe("GraficoPesoView", () => {
  it("geometría: ordena por fecha, mapea peso y fecha a la caja y rotula los extremos", () => {
    const g = geometriaPeso(puntos, 300, 170);
    expect(g.puntos).toHaveLength(3);
    // el más liviano abajo y el más pesado arriba
    expect(g.puntos[0].y).toBeCloseTo(g.abajo);
    expect(g.puntos[2].y).toBeCloseTo(g.arriba);
    expect(g.puntos[0].x).toBeCloseTo(g.izquierda);
    expect(g.puntos[2].x).toBeCloseTo(g.derecha);
    expect(g.rotulos.map((r) => r.texto)).toEqual(["8.5 kg", "12 kg"]);
  });

  it("un solo punto va al centro", () => {
    const g = geometriaPeso([puntos[0]], 300, 170);
    expect(g.puntos[0].x).toBeCloseTo(150);
    expect(g.rotulos).toHaveLength(1);
  });

  it("se renderiza con descripción para accesibilidad", async () => {
    await render(<GraficoPesoView puntos={puntos} />);
    expect(screen.getByLabelText(/Evolución del peso: 8\.5 kg el /)).toBeTruthy();
  });
});
