jest.mock("@expo/vector-icons", () => require("./iconosFalsos"));
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { SelectorFecha } from "../../src/ui/common/SelectorFecha";
import { Fechas } from "../../src/util/fechas";
import { LocalDate, Reloj } from "../../src/util/tiempo";

beforeEach(() => Reloj.fijar(new Date(2026, 2, 10, 9, 0))); // 10 de marzo de 2026
afterEach(() => Reloj.fijar(null));

const etiqueta = (d: number) => Fechas.larga(LocalDate.of(2026, 3, d));

describe("SelectorFecha", () => {
  it("elige un día habilitado y cierra", async () => {
    const alElegir = jest.fn();
    const alCerrar = jest.fn();
    await render(<SelectorFecha visible alElegir={alElegir} alCerrar={alCerrar} />);
    await fireEvent.press(screen.getByLabelText(etiqueta(15)));
    expect(alElegir).toHaveBeenCalledTimes(1);
    expect((alElegir.mock.calls[0][0] as LocalDate).equals(LocalDate.of(2026, 3, 15))).toBe(true);
    expect(alCerrar).toHaveBeenCalled();
  });

  it("los días deshabilitados no eligen (solo avisan)", async () => {
    const alElegir = jest.fn();
    const alTocarBloqueado = jest.fn();
    await render(
      <SelectorFecha
        visible alElegir={alElegir} alCerrar={jest.fn()} alTocarBloqueado={alTocarBloqueado}
        diaHabilitado={(f) => f.dayOfWeek !== 1} // lunes bloqueados
      />,
    );
    await fireEvent.press(screen.getByLabelText(etiqueta(16))); // lunes
    expect(alElegir).not.toHaveBeenCalled();
    expect(alTocarBloqueado).toHaveBeenCalledTimes(1);
  });

  it("los días anteriores a la mínima no responden", async () => {
    const alElegir = jest.fn();
    await render(<SelectorFecha visible minima={LocalDate.of(2026, 3, 10)} alElegir={alElegir} alCerrar={jest.fn()} />);
    expect(screen.getByLabelText(etiqueta(5))).toBeDisabled();
    await fireEvent.press(screen.getByLabelText(etiqueta(5)));
    expect(alElegir).not.toHaveBeenCalled();
  });

  it("navega entre meses y no retrocede antes de la mínima", async () => {
    await render(<SelectorFecha visible minima={LocalDate.of(2026, 3, 10)} alElegir={jest.fn()} alCerrar={jest.fn()} />);
    expect(screen.getByText("Marzo 2026")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Mes anterior"));
    expect(screen.getByText("Marzo 2026")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Mes siguiente"));
    expect(screen.getByText("Abril 2026")).toBeTruthy();
  });

  describe("web", () => {
    const original = Platform.OS;
    const oyentes: ((e: { key: string }) => void)[] = [];
    beforeEach(() => {
      Platform.OS = "web";
      (globalThis as unknown as { document: unknown }).document = {
        addEventListener: (_: string, o: (e: { key: string }) => void) => oyentes.push(o),
        removeEventListener: (_: string, o: (e: { key: string }) => void) => oyentes.splice(oyentes.indexOf(o), 1),
      };
    });
    afterEach(() => {
      Platform.OS = original;
      delete (globalThis as unknown as { document?: unknown }).document;
      oyentes.length = 0;
    });

    it("Escape cierra el selector", async () => {
      const alCerrar = jest.fn();
      await render(<SelectorFecha visible alElegir={jest.fn()} alCerrar={alCerrar} />);
      expect(oyentes.length).toBe(1);
      await act(async () => oyentes[0]({ key: "Enter" }));
      expect(alCerrar).not.toHaveBeenCalled();
      await act(async () => oyentes[0]({ key: "Escape" }));
      expect(alCerrar).toHaveBeenCalledTimes(1);
    });
  });
});
