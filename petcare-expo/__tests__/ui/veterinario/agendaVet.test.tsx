/* AgendaVetSeccion: PantallasTest.vet_agendaListaLosProximosYCambiaDeSolapa. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { AgendaVet, filasDeAgenda } from "../../../src/ui/veterinario/AgendaVet";
import { AgendaRepo } from "../../../src/data/repositorio/agendaRepo";
import { cargarEscenarioVet } from "./escenarioVet";

beforeEach(() => {
  prepararServicios();
  fijarRuta();
  cargarEscenarioVet(fuente());
});
afterEach(() => limpiarServicios());

describe("AgendaVet", () => {
  it("lista los próximos agrupados por fecha y cambia de solapa", async () => {
    await ingresarComoVeterinario();
    await render(<AgendaVet />);
    expect(screen.getByText("Agenda")).toBeTruthy();
    expect(screen.getByText("2 turnos")).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);

    await fireEvent.press(screen.getByRole("tab", { name: "Completados" }));
    expect(screen.getByText("1 turno")).toBeTruthy();
    expect(screen.getByText("Completado")).toBeTruthy();
    expect(screen.queryByText("Mia")).toBeNull();
  });

  it("sin turnos cancelados muestra el estado vacío", async () => {
    await ingresarComoVeterinario();
    await render(<AgendaVet />);
    await fireEvent.press(screen.getByRole("tab", { name: "Cancelados" }));
    expect(screen.getByText("No hay turnos cancelados")).toBeTruthy();
    expect(screen.getByText("Los turnos agendados con vos aparecen acá")).toBeTruthy();
    expect(screen.getByText("0 turnos")).toBeTruthy();
  });

  it("tocar un turno abre su detalle y la flecha vuelve al inicio", async () => {
    await ingresarComoVeterinario();
    await render(<AgendaVet />);
    await fireEvent.press(screen.getByText("Mia"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/evento/[id]", params: { id: "t2" } });
    await fireEvent.press(screen.getByLabelText("Volver atrás"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/vet");
  });

  it("filasDeAgenda pone un encabezado por fecha", async () => {
    await ingresarComoVeterinario();
    const filas = filasDeAgenda(AgendaRepo.proximos());
    expect(filas.map((f) => f.tipo)).toEqual(["encabezado", "turno", "encabezado", "turno"]);
  });
});
