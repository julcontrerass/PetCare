import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fijarRuta, enrutador } from "../../soporte/rutas";
import { limpiarServicios, fuente, prepararServicios } from "../../soporte/pruebaBase";
import { Escenario, type FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { Avisos } from "../../../src/ui/common/Avisos";
import { EstadoAuth } from "../../../src/ui/auth/estadoAuth";
import AuthPantalla from "../../../src/ui/auth/AuthPantalla";

let servidor: FuenteEnMemoria;

beforeEach(() => {
  servidor = prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
});
afterEach(() => {
  limpiarServicios();
  Avisos.reiniciar();
});

/** Abre el ingreso desde la bienvenida y escribe el correo y la contraseña. */
async function llenarIngreso(correo: string, clave: string) {
  await render(<AuthPantalla />);
  await fireEvent.press(screen.getByText("Iniciar Sesión"));
  await fireEvent.changeText(screen.getByLabelText("Correo electrónico"), correo);
  await fireEvent.changeText(screen.getByLabelText("Contraseña"), clave);
}

async function ingresar() {
  await fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("AuthPantalla: bienvenida", () => {
  it("muestra los textos de la bienvenida y los dos botones", async () => {
    await render(<AuthPantalla />);
    expect(screen.getByText("Bienvenido a PetCare")).toBeTruthy();
    expect(screen.getByText(/El historial clínico de tus mascotas/)).toBeTruthy();
    expect(screen.getByText("Iniciar Sesión")).toBeTruthy();
    expect(screen.getByText("Crear Cuenta")).toBeTruthy();
  });

  it("al abrirse restaura la sesión guardada y va al panel", async () => {
    servidor.haySesionGuardada = true;
    await render(<AuthPantalla />);
    await waitFor(() => expect(enrutador.replace).toHaveBeenCalledWith("/dueno"));
  });
});

describe("AuthPantalla: ingreso", () => {
  it("con una cuenta de dueño va a /dueno", async () => {
    servidor.yo = Escenario.dueno();
    await llenarIngreso("  Ana@Prueba.test ", "123456");
    await ingresar();
    await waitFor(() => expect(enrutador.replace).toHaveBeenCalledWith("/dueno"));
    expect(servidor.haySesionGuardada).toBe(true);
  });

  it("con una cuenta de veterinario sin mascotas va a /vet", async () => {
    servidor.yo = Escenario.veterinario();
    await llenarIngreso("vet@prueba.test", "123456");
    await ingresar();
    await waitFor(() => expect(enrutador.replace).toHaveBeenCalledWith("/vet"));
  });

  it("con la cuenta del administrador va a /admin", async () => {
    servidor.yo = Escenario.admin();
    await llenarIngreso("admin@prueba.test", "123456");
    await ingresar();
    await waitFor(() => expect(enrutador.replace).toHaveBeenCalledWith("/admin"));
  });

  it("un correo inválido no consulta al servidor", async () => {
    const espiar = jest.spyOn(servidor, "ingresar");
    await llenarIngreso("esto-no-es-un-correo", "123456");
    await ingresar();
    expect(screen.getByText("Ingresá un correo válido")).toBeTruthy();
    expect(espiar).not.toHaveBeenCalled();
  });

  it("sin contraseña pide que la ingrese", async () => {
    const espiar = jest.spyOn(servidor, "ingresar");
    await llenarIngreso("ana@prueba.test", "");
    await ingresar();
    expect(screen.getByText("Ingresá tu contraseña")).toBeTruthy();
    expect(espiar).not.toHaveBeenCalled();
  });

  it("si el servidor rechaza el ingreso muestra el error y no navega", async () => {
    jest.spyOn(servidor, "ingresar").mockRejectedValue(new Error("Invalid login credentials"));
    await llenarIngreso("ana@prueba.test", "equivocada");
    await ingresar();
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(Avisos.estado.carteles[0].peligro).toBe(true);
    expect(enrutador.replace).not.toHaveBeenCalled();
  });

  it("una cuenta de veterinario en revisión no entra y explica por qué", async () => {
    servidor.yo = Escenario.veterinario("vet-1", "Dr. Vera", "pendiente_revision");
    await llenarIngreso("vet@prueba.test", "123456");
    await ingresar();
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(Avisos.estado.carteles[0].titulo).toBe("No podés ingresar");
    expect(Avisos.estado.carteles[0].mensaje).toContain("Tu cuenta está en revisión");
    expect(enrutador.replace).not.toHaveBeenCalled();
    expect(fuente().haySesionGuardada).toBe(false);
  });

  it("una cuenta suspendida muestra el motivo", async () => {
    servidor.yo = Escenario.perfil("dueno-1", "dueno", "Ana", { estado: "suspendido", motivo: "Uso indebido" });
    await llenarIngreso("ana@prueba.test", "123456");
    await ingresar();
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(Avisos.estado.carteles[0].mensaje).toContain("El administrador suspendió tu cuenta.");
    expect(Avisos.estado.carteles[0].mensaje).toContain("Motivo: Uso indebido");
  });

  it("una cuenta de dueño y veterinario pregunta cómo ingresar y entra en el modo elegido", async () => {
    servidor.yo = Escenario.duenoYVeterinario("activo");
    await llenarIngreso("ana@prueba.test", "123456");
    await ingresar();
    expect(await screen.findByText("¿Cómo querés ingresar?")).toBeTruthy();
    expect(screen.getByText("Como dueño de mascotas")).toBeTruthy();
    expect(enrutador.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Como veterinario"));
    await waitFor(() => expect(enrutador.replace).toHaveBeenCalledWith("/vet"));
  });

  it("Enter en la contraseña envía el formulario", async () => {
    servidor.yo = Escenario.dueno();
    await llenarIngreso("ana@prueba.test", "123456");
    await fireEvent(screen.getByLabelText("Contraseña"), "submitEditing");
    await waitFor(() => expect(enrutador.replace).toHaveBeenCalledWith("/dueno"));
  });
});

describe("AuthPantalla: recuperar contraseña y registro", () => {
  it("pide un correo válido antes de enviar el enlace", async () => {
    const espiar = jest.spyOn(servidor, "recuperarPassword");
    await render(<AuthPantalla />);
    await fireEvent.press(screen.getByText("Iniciar Sesión"));
    await fireEvent.press(screen.getByText("¿Olvidaste tu contraseña?"));
    await fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "no-es-correo");
    await fireEvent.press(screen.getByText("Enviar enlace"));
    expect(screen.getByText("Correo inválido")).toBeTruthy();
    expect(espiar).not.toHaveBeenCalled();
  });

  it("envía el enlace y avisa que llegará por correo", async () => {
    const espiar = jest.spyOn(servidor, "recuperarPassword").mockResolvedValue(undefined);
    await render(<AuthPantalla />);
    await fireEvent.press(screen.getByText("Iniciar Sesión"));
    await fireEvent.press(screen.getByText("¿Olvidaste tu contraseña?"));
    await fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "ana@prueba.test");
    await fireEvent.press(screen.getByText("Enviar enlace"));
    expect(await screen.findByText("Si el correo está registrado, vas a recibir un enlace en unos minutos.")).toBeTruthy();
    expect(espiar).toHaveBeenCalledWith("ana@prueba.test");
  });

  it("elige el tipo de registro y abre el formulario que corresponde", async () => {
    await render(<AuthPantalla />);
    await fireEvent.press(screen.getByText("Crear Cuenta"));
    expect(screen.getByText("Registro de dueño")).toBeTruthy();
    await fireEvent.press(screen.getByText("Comenzar"));
    expect(enrutador.push).toHaveBeenCalledWith("/auth/registro-dueno");
    await fireEvent.press(screen.getByText("Soy veterinario"));
    expect(screen.getByText("Registro profesional")).toBeTruthy();
    await fireEvent.press(screen.getByText("Comenzar"));
    expect(enrutador.push).toHaveBeenCalledWith("/auth/registro-veterinario");
  });

  it("al volver de un registro con el correo por confirmar, deja el correo en el ingreso y avisa", async () => {
    await render(<AuthPantalla />);
    await act(async () => {
      EstadoAuth.terminarRegistro({ email: "nuevo@prueba.test", confirmarCorreo: true, esVeterinario: false });
    });
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(Avisos.estado.carteles[0].titulo).toBe("Confirmá tu correo");
    expect(Avisos.estado.carteles[0].mensaje).toContain("nuevo@prueba.test");
    expect(screen.getByLabelText("Correo electrónico").props.value).toBe("nuevo@prueba.test");
  });

  it("un veterinario recién registrado queda sin sesión, esperando la revisión", async () => {
    servidor.haySesionGuardada = true;
    await render(<AuthPantalla />);
    // (la sesión guardada entró sola al abrir: se limpia para probar solo el camino del registro)
    enrutador.replace.mockClear();
    await act(async () => {
      EstadoAuth.terminarRegistro({ email: "vet@prueba.test", confirmarCorreo: false, esVeterinario: true });
    });
    await waitFor(() => expect(servidor.haySesionGuardada).toBe(false));
    expect(screen.getByLabelText("Correo electrónico").props.value).toBe("vet@prueba.test");
  });
});
