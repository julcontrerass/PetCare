/* Sala de espera: la recepción marca que el dueño llegó y el veterinario ve quién espera; sin recepción lo marca él. */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { AgendaRepo } from "../../../src/data/repositorio/agendaRepo";
import { Avisos } from "../../../src/ui/common/Avisos";
import DetalleEventoVetPantalla from "../../../src/ui/veterinario/DetalleEventoVetPantalla";
import { InicioVet } from "../../../src/ui/veterinario/InicioVet";
import { textoEspera } from "../../../src/ui/veterinario/SalaDeEspera";
import { entrarComoVeterinario, fijarHoy, liberarHoy } from "./escenarioDetalleVet";

/** 8:00 del lunes del escenario: Rex (t1) tiene turno a las 10. */
const HACE_10_MIN = new Date(2026, 10, 23, 7, 50, 0).toISOString();

beforeEach(() => {
  fijarHoy();
  prepararServicios();
  fijarRuta({ id: "t1" });
  Avisos.reiniciar();
});
afterEach(() => {
  liberarHoy();
  limpiarServicios();
  Avisos.reiniciar();
});

function llegoRex() {
  const t = fuente().turnosGuardados.find((x) => x.id === "t1")!;
  t.llegada = "en_espera";
  t.llegada_at = HACE_10_MIN;
}

describe("Sala de espera en el inicio del veterinario", () => {
  it("sin nadie esperando no aparece", async () => {
    await entrarComoVeterinario(fuente());
    await render(<InicioVet />);
    expect(screen.queryByText("Sala de espera")).toBeNull();
  });

  it("muestra a quien marcó la recepción, cuánto hace que espera, y lleva a atenderlo", async () => {
    fuente().conRecepcion = true;
    const servidor = fuente();
    await entrarComoVeterinario(servidor);
    llegoRex();
    await act(async () => {
      await AgendaRepo.cargar();
    });
    await render(<InicioVet />);

    expect(screen.getByText("Sala de espera")).toBeTruthy();
    expect(screen.getByText("1 esperando")).toBeTruthy();
    expect(screen.getAllByText("Llegó hace 10 min").length).toBeGreaterThan(0);
    // El próximo es el que ya está esperando
    expect(screen.getByText("En sala de espera")).toBeTruthy();
    expect(screen.getByText("En espera")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Rex en sala de espera, turno de las 10:00, llegó hace 10 min"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/evento/[id]", params: { id: "t1" } });
  });

  it("el texto de la espera", () => {
    expect(textoEspera(null)).toBe("Llegó");
    expect(textoEspera(new Date(2026, 10, 23, 8, 0, 0).toISOString())).toBe("Llegó recién");
    expect(textoEspera(HACE_10_MIN)).toBe("Llegó hace 10 min");
  });
});

describe("Llegada en el detalle del turno", () => {
  it("con recepción el veterinario no la marca: ve que la marca su recepción", async () => {
    fuente().conRecepcion = true;
    await entrarComoVeterinario(fuente());
    await render(<DetalleEventoVetPantalla />);
    expect(screen.getByText("Tu recepción la marca cuando llegue")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Llegó" })).toBeNull();
    expect(screen.queryByRole("button", { name: "No vino" })).toBeNull();
  });

  it("con recepción, cuando ya llegó lo muestra y el botón dice Atender", async () => {
    fuente().conRecepcion = true;
    await entrarComoVeterinario(fuente());
    llegoRex();
    await act(async () => {
      await AgendaRepo.cargar();
    });
    await render(<DetalleEventoVetPantalla />);
    expect(screen.getByText("En sala de espera")).toBeTruthy();
    expect(screen.getByText(/En sala de espera desde las \d{2}:\d{2} hs/)).toBeTruthy();
    expect(screen.getByText("Atender")).toBeTruthy();
  });

  it("sin recepción la marca el veterinario, y la puede quitar", async () => {
    await entrarComoVeterinario(fuente());
    await render(<DetalleEventoVetPantalla />);
    expect(screen.getByText("Marcala cuando llegue")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Llegó" }));
    await act(async () => {});
    expect(AgendaRepo.porId("t1")?.llegada).toBe("en_espera");
    expect(fuente().llamadas).toContain("turno:t1:llegada=en_espera");
    expect(Avisos.estado.banner?.mensaje).toBe("Lo pasaste a la sala de espera");
    expect(screen.getByText("Atender")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Quitar llegada" }));
    await act(async () => {});
    expect(AgendaRepo.porId("t1")?.llegada).toBeNull();
    expect(screen.getByRole("button", { name: "No vino" })).toBeTruthy();
  });
});
