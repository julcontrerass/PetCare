/* Pruebas de humo del cascarón del veterinario (HomeVeterinarioActivity, VetBottomNav). */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { BarraVet } from "../../../src/ui/veterinario/BarraVet";
import { CascaronVet } from "../../../src/ui/veterinario/CascaronVet";
import { EstadoCascaron } from "../../../src/ui/veterinario/estadoCascaronVet";
import { RutaDeSeccion, seccionDeRuta } from "../../../src/ui/veterinario/SeccionVet";
import { Avisos } from "../../../src/ui/common/Avisos";

beforeEach(() => {
  prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
});
afterEach(() => limpiarServicios());

describe("BarraVet", () => {
  it("tiene las cuatro solapas y marca la elegida", async () => {
    await render(<BarraVet seleccionada="agenda" alElegir={() => {}} alAgregar={() => {}} />);
    for (const t of ["Inicio", "Pacientes", "Agenda", "Perfil"]) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Agenda" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Inicio" }).props.accessibilityState.selected).toBe(false);
  });

  it("tocar una solapa avisa cuál es", async () => {
    const alElegir = jest.fn();
    await render(<BarraVet seleccionada="inicio" alElegir={alElegir} alAgregar={() => {}} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Pacientes" }));
    expect(alElegir).toHaveBeenCalledWith("pacientes");
  });

  it("el botón central abre AgregarConsulta", async () => {
    const alAgregar = jest.fn();
    await render(<BarraVet seleccionada="inicio" alElegir={() => {}} alAgregar={alAgregar} />);
    await fireEvent.press(screen.getByLabelText("Agregar consulta"));
    expect(alAgregar).toHaveBeenCalled();
  });
});

describe("SeccionVet", () => {
  it("relaciona cada solapa con su ruta", () => {
    expect(RutaDeSeccion.inicio).toBe("index");
    expect(seccionDeRuta("pacientes")).toBe("pacientes");
    expect(seccionDeRuta("otra")).toBeNull();
  });
});

describe("CascaronVet", () => {
  it("con sesión monta el panel de avisos solo cuando se toca la campana", async () => {
    await ingresarComoVeterinario();
    await render(<CascaronVet />);
    expect(screen.queryByText("Notificaciones")).toBeNull();
    await act(async () => {
      EstadoCascaron.abrirAvisos();
    });
    await act(async () => {});
    expect(screen.getByText("Notificaciones")).toBeTruthy();
  });

  it("sin sesión vuelve al ingreso", async () => {
    await render(<CascaronVet />);
    expect(enrutador.replace).toHaveBeenCalledWith("/auth");
  });

  it("registra y suelta el pedido de foto", async () => {
    await ingresarComoVeterinario();
    const { unmount } = await render(<CascaronVet />);
    expect(EstadoCascaron.manejadorFoto).not.toBeNull();
    await unmount();
    expect(EstadoCascaron.manejadorFoto).toBeNull();
  });
});
