jest.mock("@expo/vector-icons", () => require("./iconosFalsos"));
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Campo } from "../../src/ui/common/Campo";

describe("Campo", () => {
  it("muestra la etiqueta y avisa los cambios", async () => {
    const alCambiar = jest.fn();
    await render(<Campo etiqueta="Nombre" value="" onChangeText={alCambiar} />);
    expect(screen.getByText("Nombre")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Nombre"), "Luna");
    expect(alCambiar).toHaveBeenCalledWith("Luna");
  });

  it("muestra el error y no la ayuda", async () => {
    await render(<Campo etiqueta="Correo" error="Correo inválido" ayuda="Tu correo" />);
    expect(screen.getByText("Correo inválido")).toBeTruthy();
    expect(screen.queryByText("Tu correo")).toBeNull();
  });

  it("la contraseña se oculta y el ojito la muestra", async () => {
    await render(<Campo etiqueta="Contraseña" contrasena />);
    expect(screen.getByLabelText("Contraseña").props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText("Mostrar contraseña"));
    expect(screen.getByLabelText("Contraseña").props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText("Ocultar contraseña")).toBeTruthy();
  });

  it("Enter envía con onSubmitEditing", async () => {
    const enviar = jest.fn();
    await render(<Campo etiqueta="Correo" onSubmitEditing={enviar} />);
    await fireEvent(screen.getByLabelText("Correo"), "submitEditing");
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
