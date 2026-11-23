jest.mock("@expo/vector-icons", () => require("./iconosFalsos"));
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Boton } from "../../src/ui/common/Boton";

describe("Boton", () => {
  it("llama a onPress", async () => {
    const onPress = jest.fn();
    await render(<Boton titulo="Guardar" onPress={onPress} />);
    await fireEvent.press(screen.getByText("Guardar"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("deshabilitado no responde y lo informa a accesibilidad", async () => {
    const onPress = jest.fn();
    await render(<Boton titulo="Guardar" onPress={onPress} deshabilitado />);
    await fireEvent.press(screen.getByText("Guardar"));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("cargando no responde y no muestra el título", async () => {
    const onPress = jest.fn();
    await render(<Boton titulo="Guardar" onPress={onPress} cargando />);
    expect(screen.queryByText("Guardar")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
