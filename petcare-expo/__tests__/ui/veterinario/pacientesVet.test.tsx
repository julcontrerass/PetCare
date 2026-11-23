/* PacientesVetSeccion: PantallasTest.vet_listaDePacientesFiltraPorBusqueda. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { PacientesVet } from "../../../src/ui/veterinario/PacientesVet";
import { cargarEscenarioVet } from "./escenarioVet";

beforeEach(() => {
  prepararServicios();
  fijarRuta();
  cargarEscenarioVet(fuente());
});
afterEach(() => limpiarServicios());

describe("PacientesVet", () => {
  it("lista los pacientes con el contador y los turnos próximos", async () => {
    await ingresarComoVeterinario();
    await render(<PacientesVet />);
    expect(screen.getByText("Mis pacientes")).toBeTruthy();
    expect(screen.getByText("2 pacientes")).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.getByText("Todos (2)")).toBeTruthy();
    expect(screen.getByText("Perros (1)")).toBeTruthy();
    expect(screen.getByText("Gatos (1)")).toBeTruthy();
    expect(screen.getByText(/Próximo turno · Hoy 10:00/)).toBeTruthy();
  });

  it("filtra por búsqueda", async () => {
    await ingresarComoVeterinario();
    await render(<PacientesVet />);
    await fireEvent.changeText(screen.getByLabelText("Buscar paciente"), "mia");
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.queryByText("Rex")).toBeNull();
  });

  it("filtra por tipo de animal y avisa cuando no hay resultados", async () => {
    await ingresarComoVeterinario();
    await render(<PacientesVet />);
    await fireEvent.press(screen.getByRole("tab", { name: "Gatos (1)" }));
    expect(screen.queryByText("Rex")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Buscar paciente"), "zzz");
    expect(screen.getByText("No encontramos pacientes")).toBeTruthy();
    expect(screen.getByText("Probá con otra búsqueda o agregá uno nuevo")).toBeTruthy();
  });

  it("tocar un paciente abre su ficha y + agrega uno nuevo", async () => {
    await ingresarComoVeterinario();
    await render(<PacientesVet />);
    await fireEvent.press(screen.getByText("Mia"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/paciente/[id]", params: { id: "m2" } });
    await fireEvent.press(screen.getByLabelText("Agregar paciente"));
    expect(enrutador.push).toHaveBeenCalledWith("/vet/dueno-nuevo");
  });
});
