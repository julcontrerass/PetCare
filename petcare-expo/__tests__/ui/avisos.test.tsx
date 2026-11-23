jest.mock("@expo/vector-icons", () => require("./iconosFalsos"));
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Avisos } from "../../src/ui/common/Avisos";
import { AvisosHost } from "../../src/ui/common/AvisosHost";

beforeEach(() => {
  jest.useFakeTimers();
  Avisos.reiniciar();
});
afterEach(() => {
  Avisos.reiniciar();
  jest.useRealTimers();
});

describe("Avisos (almacén)", () => {
  it("decide el tipo de aviso por las palabras de éxito", () => {
    Avisos.mostrar("Mascota guardada correctamente");
    expect(Avisos.estado.banner?.tipo).toBe("exito");
    Avisos.mostrar("Falta elegir la fecha");
    expect(Avisos.estado.banner?.tipo).toBe("aviso");
    Avisos.mostrar("Falta elegir", "info");
    expect(Avisos.estado.banner?.tipo).toBe("info");
  });

  it("el aviso breve se retira solo a los 3200 ms", async () => {
    Avisos.exito("Listo");
    expect(Avisos.estado.banner).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(3199);
    });
    expect(Avisos.estado.banner).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(2);
    });
    expect(Avisos.estado.banner).toBeNull();
  });

  it("error elige el título según el mensaje", () => {
    Avisos.error("Revisá tu conexión a internet");
    expect(Avisos.estado.carteles[0].titulo).toBe("Sin conexión");
    Avisos.reiniciar();
    Avisos.error("No tenés permiso para esto: falta el permiso");
    expect(Avisos.estado.carteles[0].titulo).toBe("No tenés permiso");
    Avisos.reiniciar();
    Avisos.error("Algo salió mal");
    expect(Avisos.estado.carteles[0].titulo).toBe("No se pudo completar");
    Avisos.reiniciar();
    Avisos.error("Algo salió mal", "Mi título");
    expect(Avisos.estado.carteles[0].titulo).toBe("Mi título");
  });
});

describe("AvisosHost", () => {
  it("confirmar muestra el cartel y llama a alAceptar al aceptar", async () => {
    const alAceptar = jest.fn();
    await render(<AvisosHost />);
    await act(async () => {
      Avisos.confirmar({ titulo: "Eliminar", mensaje: "¿Seguro?", textoAceptar: "Eliminar mascota", alAceptar });
    });
    expect(screen.getByText("¿Seguro?")).toBeTruthy();
    expect(screen.getByText("Volver")).toBeTruthy();
    await fireEvent.press(screen.getByText("Eliminar mascota"));
    expect(alAceptar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Seguro?")).toBeNull();
  });

  it("cancelar cierra el cartel sin llamar a alAceptar", async () => {
    const alAceptar = jest.fn();
    await render(<AvisosHost />);
    await act(async () => {
      Avisos.confirmar({ titulo: "Eliminar", mensaje: "¿Seguro?", textoAceptar: "Sí", textoCancelar: "No", alAceptar });
    });
    await fireEvent.press(screen.getByText("No"));
    expect(alAceptar).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Seguro?")).toBeNull();
  });

  it("error muestra el título por defecto y el botón Entendido", async () => {
    await render(<AvisosHost />);
    await act(async () => {
      Avisos.error("Sin conexión a internet, revisá tu conexión");
    });
    expect(screen.getByText("Sin conexión")).toBeTruthy();
    await fireEvent.press(screen.getByText("Entendido"));
    expect(screen.queryByText("Sin conexión")).toBeNull();
  });

  it("muestra el banner con el mensaje", async () => {
    await render(<AvisosHost />);
    await act(async () => {
      Avisos.mostrar("Turno cancelado");
    });
    expect(screen.getByText("Turno cancelado")).toBeTruthy();
  });
});
