/* InicioVetSeccion: PantallasTest.vet_homeMuestraLosTurnosDeHoy y vet_elInicioMuestraLasVacunasARecordarYSuLista. */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { InicioVet, turnoEnHorario } from "../../../src/ui/veterinario/InicioVet";
import { EstadoCascaron } from "../../../src/ui/veterinario/estadoCascaronVet";
import { crearEventoVet } from "../../../src/data/repositorio/agendaRepo";
import { LocalDate } from "../../../src/util/tiempo";
import { cargarEscenarioVet, hoy } from "./escenarioVet";

beforeEach(() => {
  prepararServicios();
  fijarRuta();
  cargarEscenarioVet(fuente());
});
afterEach(() => limpiarServicios());

describe("InicioVet", () => {
  it("saluda y muestra los turnos de hoy", async () => {
    await ingresarComoVeterinario();
    await render(<InicioVet />);
    expect(screen.getByText("Hola, Dr. Vera")).toBeTruthy();
    expect(screen.getByText("Consultas de hoy")).toBeTruthy();
    expect(screen.getByText("10:00")).toBeTruthy();
    expect(screen.getByText("Pendientes")).toBeTruthy();
    expect(screen.getByText("Pacientes hoy")).toBeTruthy();
    expect(screen.getByText("Todo al día")).toBeTruthy();
  });

  it("tocar el turno abre su detalle", async () => {
    await ingresarComoVeterinario();
    await render(<InicioVet />);
    await fireEvent.press(screen.getByText("Rex"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/evento/[id]", params: { id: "t1" } });
  });

  it("sin turnos hoy muestra la agenda libre", async () => {
    fuente().turnosGuardados.length = 0;
    await ingresarComoVeterinario();
    await render(<InicioVet />);
    expect(screen.getByText("Agenda libre")).toBeTruthy();
    expect(screen.getByText("Sin consultas hoy")).toBeTruthy();
    expect(screen.getByText("Sin consultas para hoy")).toBeTruthy();
    await fireEvent.press(screen.getAllByText("Ver agenda")[0]);
    expect(enrutador.navigate).toHaveBeenCalledWith("/vet/agenda");
  });

  it("muestra las vacunas a recordar y abre su lista", async () => {
    fuente().registros.push({
      id: "r1", mascota_id: "m1", tipo: "vacuna", titulo: "Rabia", descripcion: null,
      fecha: hoy.minusDays(300).toString(), veterinario: null, proxima_dosis: hoy.minusDays(5).toString(),
    } as never);
    await ingresarComoVeterinario();
    await render(<InicioVet />);
    expect(screen.getByText(/1 paciente con una dosis/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Vacunas a recordar"));
    expect(enrutador.push).toHaveBeenCalledWith("/vet/vacunas-pendientes");
  });

  it("el tile de solicitudes y la campana navegan", async () => {
    await ingresarComoVeterinario();
    const abrir = jest.fn();
    EstadoCascaron.manejadorAvisos = abrir;
    await render(<InicioVet />);
    await fireEvent.press(screen.getByLabelText(/^Solicitudes/));
    expect(enrutador.push).toHaveBeenCalledWith("/vet/solicitudes");
    await fireEvent.press(screen.getByLabelText("Notificaciones"));
    expect(abrir).toHaveBeenCalled();
    EstadoCascaron.manejadorAvisos = null;
  });

  it("la foto lleva al perfil", async () => {
    await ingresarComoVeterinario();
    await render(<InicioVet />);
    await fireEvent.press(screen.getByLabelText("Ir al perfil"));
    expect(enrutador.navigate).toHaveBeenCalledWith("/vet/perfil");
    await act(async () => {});
  });
});

describe("turnoEnHorario", () => {
  const e = (id: string, hora: string) => crearEventoVet({
    id, pacienteId: "m1", tipo: "Control", motivo: "x", fecha: LocalDate.now(), hora, estado: "PENDIENTE", notas: "", veterinario: "",
  });
  it("elige el primero a menos de 45 minutos o en la misma hora", () => {
    const ahora = new Date(2026, 0, 5, 10, 20);
    expect(turnoEnHorario([e("a", "08:00"), e("b", "10:50"), e("c", "11:00")], ahora)).toBe("b");
    expect(turnoEnHorario([e("a", "08:00"), e("c", "12:00")], ahora)).toBeNull();
    expect(turnoEnHorario([e("a", "10:59")], ahora)).toBe("a");
  });
});
