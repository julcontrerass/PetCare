import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Escenario } from "../../soporte/fuenteEnMemoria";
import { AgendaRepo } from "../../../src/data/repositorio/agendaRepo";
import { Avisos } from "../../../src/ui/common/Avisos";
import DetalleEventoVetPantalla from "../../../src/ui/veterinario/DetalleEventoVetPantalla";
import { entrarComoVeterinario, fijarHoy, liberarHoy } from "./escenarioDetalleVet";

beforeEach(async () => {
  fijarHoy();
  const servidor = prepararServicios();
  fijarRuta({ id: "t1" });
  Avisos.reiniciar();
  await entrarComoVeterinario(servidor);
});
afterEach(() => {
  liberarHoy();
  limpiarServicios();
  Avisos.reiniciar();
});

describe("DetalleEventoVetPantalla", () => {
  it("muestra el turno, el paciente y los botones de un turno pendiente", async () => {
    await render(<DetalleEventoVetPantalla />);
    expect(screen.getByText("Detalle del turno")).toBeTruthy();
    expect(screen.getAllByText("Control").length).toBeGreaterThan(0);
    expect(screen.getByText("Pendiente")).toBeTruthy();
    expect(screen.getByText("Hoy")).toBeTruthy();
    expect(screen.getByText("10:00 hs")).toBeTruthy();
    expect(screen.getByText("Rex")).toBeTruthy();
    expect(screen.getByText("Propietario/a: Ana Prueba")).toBeTruthy();
    expect(screen.getByText("Sin notas")).toBeTruthy();
    expect(screen.getByText("Iniciar turno")).toBeTruthy();
    expect(screen.getByText("Marcar como completado")).toBeTruthy();
  });

  it("se puede completar y los botones de turno pendiente desaparecen", async () => {
    await render(<DetalleEventoVetPantalla />);
    await fireEvent.press(screen.getByText("Marcar como completado"));
    await act(async () => {});
    expect(AgendaRepo.porId("t1")?.estado).toBe("COMPLETADO");
    expect(fuente().turnosGuardados.find((t) => t.id === "t1")?.estado).toBe("completado");
    expect(Avisos.estado.banner?.mensaje).toBe("Turno marcado como completado");
    expect(screen.queryByText("Marcar como completado")).toBeNull();
    expect(screen.queryByText("Iniciar turno")).toBeNull();
  });

  it("se puede cancelar con confirmación", async () => {
    await render(<DetalleEventoVetPantalla />);
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
    const cartel = Avisos.estado.carteles[0];
    expect(cartel.titulo).toBe("¿Cancelar este turno?");
    expect(cartel.mensaje).toContain("Vas a cancelar el turno de Rex del 23 Nov 2026 a las 10:00 hs. El dueño va a recibir un aviso.");
    await act(async () => {
      Avisos.cerrarCartel(cartel.id, true);
    });
    expect(fuente().turnosGuardados.find((t) => t.id === "t1")?.estado).toBe("cancelado");
    expect(screen.getByText("Cancelado")).toBeTruthy();
  });

  it("iniciar el turno abre la ficha con el informe del turno", async () => {
    await render(<DetalleEventoVetPantalla />);
    await fireEvent.press(screen.getByText("Iniciar turno"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/paciente/[id]", params: { id: "m1", evento: "t1" } });
  });

  it("con informe escrito lo muestra y ofrece continuarlo", async () => {
    fuente().informes.push({
      id: "i1", mascota_id: "m1", turno_id: "t1", veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Otitis",
      tratamiento: "Gotas por 7 días", created_at: new Date().toISOString(),
    });
    await render(<DetalleEventoVetPantalla />);
    expect(await screen.findByText("Informe de la consulta")).toBeTruthy();
    expect(screen.getByText(/Diagnóstico Otitis/)).toBeTruthy();
    expect(screen.getByText("Continuar informe")).toBeTruthy();
  });

  it("muestra los estudios previos que adjuntó el dueño", async () => {
    fuente().estudios.push({ id: "e1", turno_id: "t1", storage_path: "x/e1.pdf", nombre: "Hemograma", extension: "pdf", tipo: "Análisis" });
    await render(<DetalleEventoVetPantalla />);
    expect(await screen.findByText("Estudios previos del dueño")).toBeTruthy();
    expect(screen.getByText("Análisis · PDF")).toBeTruthy();
    expect(screen.getByText("Hemograma")).toBeTruthy();
  });

  it("tocar al paciente abre su ficha", async () => {
    await render(<DetalleEventoVetPantalla />);
    await fireEvent.press(screen.getByLabelText("Ver la ficha de Rex"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/paciente/[id]", params: { id: "m1" } });
  });

  it("editar abre el formulario y guardar actualiza el turno", async () => {
    await render(<DetalleEventoVetPantalla />);
    await fireEvent.press(screen.getByText("Editar"));
    expect(screen.getByText("Editar turno")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Motivo"), "Control de oído");
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(AgendaRepo.porId("t1")?.motivo).toBe("Control de oído");
    expect(Avisos.estado.banner?.mensaje).toBe("Turno actualizado");
  });

  it("editar sin motivo marca el campo como requerido", async () => {
    await render(<DetalleEventoVetPantalla />);
    await fireEvent.press(screen.getByText("Editar"));
    await fireEvent.changeText(screen.getByLabelText("Motivo"), "");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("Requerido")).toBeTruthy();
  });

  it("un turno inexistente avisa y cierra la pantalla", async () => {
    fijarRuta({ id: "no-existe" });
    await render(<DetalleEventoVetPantalla />);
    expect(Avisos.estado.banner?.mensaje).toBe("No se encontró el turno");
    expect(enrutador.back).toHaveBeenCalled();
  });
});
