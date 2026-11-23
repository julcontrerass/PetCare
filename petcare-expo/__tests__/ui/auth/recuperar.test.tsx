import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { Avisos } from "../../../src/ui/common/Avisos";
import NuevaPasswordPantalla, { armarEnlaceDeRecuperacion, olvidarCanjes } from "../../../src/ui/auth/NuevaPasswordPantalla";

let servidor: FuenteEnMemoria;

beforeEach(() => {
  servidor = prepararServicios();
  servidor.yo = Escenario.dueno();
  olvidarCanjes();
  Avisos.reiniciar();
});
afterEach(() => {
  limpiarServicios();
  Avisos.reiniciar();
});

describe("armarEnlaceDeRecuperacion", () => {
  it("conserva el código y los demás parámetros", () => {
    expect(armarEnlaceDeRecuperacion({ code: "abc", otro: "1" })).toBe("petcare://recuperar?code=abc&otro=1");
    expect(armarEnlaceDeRecuperacion({})).toBe("petcare://recuperar");
    expect(armarEnlaceDeRecuperacion({}, "error_code=otp_expired")).toBe("petcare://recuperar#error_code=otp_expired");
  });
});

describe("NuevaPasswordPantalla (/auth/recuperar)", () => {
  it("canjea el código del enlace y pide la contraseña nueva", async () => {
    fijarRuta({ code: "abc123" });
    await render(<NuevaPasswordPantalla />);
    expect(await screen.findByText("Elegí tu nueva contraseña")).toBeTruthy();
    expect(servidor.llamadas).toContain("enlace:petcare://recuperar?code=abc123");
    expect(screen.getByText("Confirmamos tu correo. Escribí la contraseña que vas a usar de ahora en más.")).toBeTruthy();
  });

  it("valida la longitud y que las dos contraseñas coincidan", async () => {
    fijarRuta({ code: "abc123" });
    await render(<NuevaPasswordPantalla />);
    await screen.findByText("Elegí tu nueva contraseña");

    await fireEvent.changeText(screen.getByLabelText("Nueva contraseña"), "123");
    await fireEvent.press(screen.getByText("Guardar y entrar"));
    expect(screen.getByText("Usá al menos 6 caracteres")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Nueva contraseña"), "secreta1");
    await fireEvent.changeText(screen.getByLabelText("Repetí la contraseña"), "otra");
    await fireEvent.press(screen.getByText("Guardar y entrar"));
    expect(screen.getByText("Las contraseñas no coinciden")).toBeTruthy();
    expect(servidor.llamadas).not.toContain("definirPassword");
  });

  it("guarda la contraseña, avisa y entra directo a la cuenta", async () => {
    fijarRuta({ code: "abc123" });
    await render(<NuevaPasswordPantalla />);
    await screen.findByText("Elegí tu nueva contraseña");
    await fireEvent.changeText(screen.getByLabelText("Nueva contraseña"), "secreta1");
    await fireEvent.changeText(screen.getByLabelText("Repetí la contraseña"), "secreta1");
    await fireEvent.press(screen.getByText("Guardar y entrar"));
    await waitFor(() => expect(enrutador.replace).toHaveBeenCalledWith("/dueno"));
    expect(servidor.llamadas).toContain("definirPassword");
    expect(Avisos.estado.banner?.mensaje).toBe("Contraseña actualizada");
  });

  it("con un enlace vencido vuelve al ingreso y explica el motivo", async () => {
    servidor.errorAlAbrirEnlace = 'El enlace venció o ya se usó. Pedí uno nuevo desde "Olvidé mi contraseña".';
    fijarRuta({ code: "viejo" });
    await render(<NuevaPasswordPantalla />);
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(Avisos.estado.carteles[0].titulo).toBe("No se pudo abrir el enlace");
    expect(Avisos.estado.carteles[0].mensaje).toContain("El enlace venció");
    expect(enrutador.replace).toHaveBeenCalledWith({ pathname: "/auth", params: { vista: "login" } });
    expect(screen.queryByText("Elegí tu nueva contraseña")).toBeNull();
  });

  it("si falla al guardar, el botón vuelve a quedar disponible y se muestra el error", async () => {
    fijarRuta({ code: "abc123" });
    jest.spyOn(servidor, "definirPassword").mockRejectedValue(new Error("La contraseña es muy débil"));
    await render(<NuevaPasswordPantalla />);
    await screen.findByText("Elegí tu nueva contraseña");
    await fireEvent.changeText(screen.getByLabelText("Nueva contraseña"), "secreta1");
    await fireEvent.changeText(screen.getByLabelText("Repetí la contraseña"), "secreta1");
    await fireEvent.press(screen.getByText("Guardar y entrar"));
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(screen.getByText("Guardar y entrar")).toBeTruthy();
    expect(enrutador.replace).not.toHaveBeenCalled();
  });
});
