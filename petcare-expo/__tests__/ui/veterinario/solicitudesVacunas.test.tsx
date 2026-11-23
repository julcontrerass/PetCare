import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { accesoDto, Escenario } from "../../soporte/fuenteEnMemoria";
import { PacientesRepo } from "../../../src/data/repositorio/pacientesRepo";
import { Avisos } from "../../../src/ui/common/Avisos";
import SolicitudesVetPantalla from "../../../src/ui/veterinario/SolicitudesVetPantalla";
import VacunasPendientesPantalla, { estadoDeDosis, textoCuenta } from "../../../src/ui/veterinario/VacunasPendientesPantalla";
import { LocalDate } from "../../../src/util/tiempo";
import { entrarComoVeterinario, fijarHoy, liberarHoy } from "./escenarioDetalleVet";

beforeEach(() => {
  fijarHoy();
  prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
});
afterEach(() => {
  liberarHoy();
  limpiarServicios();
  Avisos.reiniciar();
  jest.restoreAllMocks();
});

describe("SolicitudesVetPantalla", () => {
  it("sin solicitudes muestra el estado vacío", async () => {
    await entrarComoVeterinario(fuente());
    await render(<SolicitudesVetPantalla />);
    expect(screen.getByText("Solicitudes de acceso")).toBeTruthy();
    expect(screen.getByText("0 pendientes")).toBeTruthy();
    expect(screen.getByText("Sin solicitudes")).toBeTruthy();
    expect(screen.getByText("Cuando le pidas acceso a un dueño, o un dueño te comparta una mascota, aparece acá")).toBeTruthy();
  });

  it("aceptar una solicitud suma el paciente", async () => {
    const servidor = fuente();
    servidor.mascotas.push(Escenario.mascota("m3", "Nueva"));
    servidor.accesosGuardados.push(accesoDto("a3", "m3", Escenario.VET_ID, "pendiente", "dueno"));
    await entrarComoVeterinario(servidor);
    await render(<SolicitudesVetPantalla />);
    expect(screen.getByText("1 pendiente")).toBeTruthy();
    expect(screen.getByText("Quiere compartir a Nueva")).toBeTruthy();

    await fireEvent.press(screen.getByText("Aceptar"));
    await act(async () => {});
    expect(servidor.accesosGuardados.find((a) => a.id === "a3")?.estado).toBe("activo");
    expect(PacientesRepo.porId("m3")).not.toBeNull();
    expect(Avisos.estado.banner?.mensaje).toBe("La mascota se sumó a tus pacientes");
    expect(screen.getByText("Solicitud aceptada")).toBeTruthy();
    expect(screen.getByText("0 pendientes")).toBeTruthy();
  });

  it("rechazar muestra el estado y la propia solicitud del veterinario no tiene botones", async () => {
    const servidor = fuente();
    servidor.mascotas.push(Escenario.mascota("m3", "Nueva"), Escenario.mascota("m4", "Otra"));
    servidor.accesosGuardados.push(
      accesoDto("a3", "m3", Escenario.VET_ID, "pendiente", "dueno"),
      accesoDto("a4", "m4", Escenario.VET_ID, "pendiente", "veterinario"),
    );
    await entrarComoVeterinario(servidor);
    await render(<SolicitudesVetPantalla />);
    expect(screen.getByText("Pediste acceso a Otra")).toBeTruthy();
    expect(screen.getByText("Esperando la respuesta del dueño")).toBeTruthy();
    expect(screen.getAllByText("Rechazar")).toHaveLength(1);

    await fireEvent.press(screen.getByText("Rechazar"));
    await act(async () => {});
    expect(servidor.accesosGuardados.find((a) => a.id === "a3")?.estado).toBe("rechazado");
    expect(screen.getByText("Solicitud rechazada")).toBeTruthy();
    expect(Avisos.estado.banner?.mensaje).toBe("Solicitud rechazada");
  });
});

describe("VacunasPendientesPantalla", () => {
  it("sin dosis para recordar muestra el estado vacío", async () => {
    await entrarComoVeterinario(fuente());
    await render(<VacunasPendientesPantalla />);
    expect(screen.getByText("Vacunas a recordar")).toBeTruthy();
    expect(screen.getByText("Todo al día")).toBeTruthy();
    expect(screen.getByText("No hay dosis para recordar")).toBeTruthy();
  });

  it("lista las dosis vencidas y avisa al dueño por WhatsApp o llamada", async () => {
    const hoy = LocalDate.now();
    fuente().registros.push({
      id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", detalle: null, fecha: hoy.minusDays(300).toString(), proxima_dosis: hoy.minusDays(5).toString(),
    });
    await entrarComoVeterinario(fuente());
    // El dueño con cuenta trae su teléfono: sin él no hay a quién avisar
    fuente().mascotas[0] = { ...fuente().mascotas[0], dueno: { nombre: "Ana Prueba", telefono: "11 5555 0000", email: "ana@prueba.test" } };
    await PacientesRepo.cargar();
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    await render(<VacunasPendientesPantalla />);
    expect(screen.getByText("1 dosis para recordar")).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.getByText(/^Dueño: Ana Prueba · 11 5555 0000/)).toBeTruthy();
    expect(screen.getByText("Rabia")).toBeTruthy();
    expect(screen.getByText("Vencida hace 5 d")).toBeTruthy();

    await fireEvent.press(screen.getByText("Avisar por WhatsApp"));
    expect(abrir).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent(String(abrir.mock.calls[0][0]));
    expect(url).toContain("https://wa.me/");
    expect(url).toContain("A Rex la vacuna Rabia venció el");
    expect(url).toContain("te escribo de Clínica Sur");

    await fireEvent.press(screen.getByText("Llamar"));
    expect(abrir).toHaveBeenLastCalledWith(expect.stringMatching(/^tel:/));
    expect(enrutador.push).not.toHaveBeenCalled();
  });

  it("textos de estado y de cuenta", () => {
    const h = LocalDate.of(2026, 11, 23);
    expect(estadoDeDosis(h.plusDays(0), h)).toEqual({ texto: "Vence hoy", tono: "aviso" });
    expect(estadoDeDosis(h.plusDays(4), h)).toEqual({ texto: "En 4 d", tono: "aviso" });
    expect(estadoDeDosis(h.minusDays(2), h)).toEqual({ texto: "Vencida hace 2 d", tono: "peligro" });
    expect(textoCuenta(0)).toBe("Todo al día");
    expect(textoCuenta(1)).toBe("1 dosis para recordar");
    expect(textoCuenta(3)).toBe("3 dosis para recordar");
  });
});
