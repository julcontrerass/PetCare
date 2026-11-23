import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Avisos } from "../../../src/ui/common/Avisos";
import { EstadoVet } from "../../../src/ui/veterinario/estadoVet";
import AgregarConsultaPantalla from "../../../src/ui/veterinario/AgregarConsultaPantalla";
import { entrarComoVeterinario, fijarHoy, liberarHoy } from "./escenarioDetalleVet";

beforeEach(async () => {
  fijarHoy();
  const servidor = prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
  await entrarComoVeterinario(servidor);
});
afterEach(() => {
  liberarHoy();
  limpiarServicios();
  Avisos.reiniciar();
});

const escribir = (etiqueta: string, texto: string) => fireEvent.changeText(screen.getByLabelText(etiqueta), texto);

async function elegirFechaYHora(dia: string, hora: string) {
  await fireEvent.press(screen.getByLabelText("Fecha: Elegir fecha"));
  await fireEvent.press(screen.getByLabelText(dia));
  await fireEvent.press(screen.getByLabelText("Hora: Elegir hora"));
  await fireEvent.press(screen.getByLabelText(hora));
}

describe("AgregarConsultaPantalla", () => {
  it("muestra los textos del formulario y la sede cuando hay al menos una", async () => {
    await render(<AgregarConsultaPantalla />);
    expect(screen.getByText("Nuevo turno")).toBeTruthy();
    expect(screen.getByText("Otorgá un turno o registrá una consulta")).toBeTruthy();
    expect(screen.getByText("Buscar dueño (DNI o email)")).toBeTruthy();
    expect(screen.getByText("Registrar dueño y mascota nuevos")).toBeTruthy();
    expect(screen.getByText("Lugar de atención")).toBeTruthy();
    expect(screen.getByText("Guardar consulta")).toBeTruthy();
  });

  it("guardar una consulta vacía no crea nada y marca lo requerido", async () => {
    await render(<AgregarConsultaPantalla />);
    await fireEvent.press(screen.getByText("Guardar consulta"));
    expect(screen.getAllByText("Requerido")).toHaveLength(3);
    expect(fuente().llamadas.some((l) => l.startsWith("crearTurno"))).toBe(false);
  });

  it("la hora pide primero la fecha", async () => {
    await render(<AgregarConsultaPantalla />);
    await fireEvent.press(screen.getByLabelText("Hora: Elegir hora"));
    expect(Avisos.estado.banner?.mensaje).toBe("Elegí primero la fecha");
  });

  it("agenda el turno del paciente elegido con la fecha, la hora y el motivo", async () => {
    fijarRuta({ paciente: "m2" });
    await render(<AgregarConsultaPantalla />);
    expect(screen.getByLabelText(/^Paciente: Mia/)).toBeTruthy();
    await elegirFechaYHora("24 de noviembre de 2026", "09:00");
    await escribir("Motivo / diagnóstico", "Revisión anual");
    await fireEvent.press(screen.getByText("Guardar consulta"));
    await act(async () => {});

    expect(fuente().llamadas).toContain("crearTurno:2026-11-24 09:00:00");
    expect(fuente().turnosGuardados.find((t) => t.motivo === "Revisión anual")?.mascota_id).toBe("m2");
    expect(Avisos.estado.banner?.mensaje).toBe("Consulta guardada");
    expect(enrutador.back).toHaveBeenCalled();
  });

  it("un día en que no atiende no se puede elegir", async () => {
    await render(<AgregarConsultaPantalla />);
    await fireEvent.press(screen.getByLabelText("Fecha: Elegir fecha"));
    await fireEvent.press(screen.getByLabelText("28 de noviembre de 2026"));
    expect(Avisos.estado.banner?.mensaje).toBe("No atendés los sábado");
  });

  it("buscar sin dato avisa que hay que ingresar un DNI o un correo", async () => {
    await render(<AgregarConsultaPantalla />);
    await fireEvent.press(screen.getByText("Buscar"));
    expect(Avisos.estado.banner?.mensaje).toBe("Ingresá un DNI o Email para buscar");
  });

  it("un dueño sin acceso recibe el pedido con el turno propuesto", async () => {
    fuente().duenosBuscables = [
      { id: "d9", nombre: "Lucía Paz", email: "lucia@prueba.test", mascotas: [{ id: "mx", nombre: "Luna", tipo: "Perro", raza: null }] },
    ];
    await render(<AgregarConsultaPantalla />);
    await escribir("Buscar dueño", "lucia@prueba.test");
    await fireEvent.press(screen.getByText("Buscar"));
    await waitFor(() => expect(screen.getByText("Dueño encontrado: Lucía Paz (lucia@prueba.test)")).toBeTruthy());
    expect(screen.getByLabelText("Mascota de este dueño: Luna (Perro) · sin acceso")).toBeTruthy();

    await elegirFechaYHora("24 de noviembre de 2026", "09:30");
    await escribir("Motivo / diagnóstico", "Primera consulta");
    await fireEvent.press(screen.getByText("Guardar consulta"));
    await waitFor(() => expect(Avisos.estado.carteles[0]?.titulo).toBe("Pedido enviado al dueño"));

    expect(fuente().llamadas).toContain("solicitarAcceso:mx");
    expect(fuente().ultimoTurnoPropuesto).toMatchObject({ categoria: "Chequeo médico integral", motivo: "Primera consulta", fecha: "2026-11-24", hora: "09:30:00" });
    expect(fuente().llamadas.some((l) => l.startsWith("crearTurno"))).toBe(false);
    expect(Avisos.estado.carteles[0].mensaje).toContain("del 24 Nov 2026 a las 09:30 hs");
  });

  it("al volver del alta de un dueño queda elegida su mascota", async () => {
    await render(<AgregarConsultaPantalla />);
    await act(async () => {
      EstadoVet.terminarAltaDeDueno("m2");
    });
    expect(Avisos.estado.banner?.mensaje).toBe("Listo, ya podés agendar el turno");
    expect(screen.getByLabelText(/^Paciente: Mia/)).toBeTruthy();
  });

  it("el botón de dueño nuevo navega a la pantalla de alta", async () => {
    await render(<AgregarConsultaPantalla />);
    await escribir("Buscar dueño", "30111999");
    await fireEvent.press(screen.getByText("Registrar dueño y mascota nuevos"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/dueno-nuevo", params: { dni: "30111999" } });
  });
});
