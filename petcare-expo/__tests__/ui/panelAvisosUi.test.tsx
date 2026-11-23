/* Pruebas de humo de PanelAvisos, TarjetaAviso y TarjetaPermiso. */
import "../soporte/pruebaBase"; // simula almacenamiento y notificaciones antes de importar los repositorios
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { LocalDateTime, Reloj } from "../../src/util/tiempo";
import { PanelAvisos, type ItemAviso } from "../../src/ui/common/PanelAvisos";
import { TarjetaAviso } from "../../src/ui/common/TarjetaAviso";
import { TarjetaPermiso } from "../../src/ui/common/TarjetaPermiso";

const permisos = (granted: boolean) => ({ granted, status: granted ? "granted" : "denied", canAskAgain: true, expires: "never" });

beforeEach(() => {
  jest.useFakeTimers();
  Reloj.fijar(new Date(2026, 4, 20, 12, 0, 0));
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(permisos(true));
});
afterEach(() => {
  Reloj.fijar(null);
  jest.useRealTimers();
});

const avisos = (): ItemAviso[] => [
  { tipo: "TURNO", titulo: "Turno confirmado", mensaje: "Rex, mañana a las 10:00", creada: LocalDateTime.of(2026, 5, 20, 11, 0), sinLeer: true },
  { tipo: "CANCELACION", titulo: "Turno cancelado", mensaje: "Luna, el viernes", creada: LocalDateTime.of(2026, 5, 19, 9, 0), sinLeer: true },
  { tipo: "COMPLETADO", titulo: "Consulta terminada", mensaje: "Ya podés ver el informe", creada: LocalDateTime.of(2026, 4, 1, 9, 0), sinLeer: false },
];

describe("PanelAvisos", () => {
  it("agrupa por día, resume los sin leer y muestra cada aviso", async () => {
    await render(<PanelAvisos visible alCerrar={() => {}} avisos={avisos()} alBorrar={() => {}} alBorrarTodas={() => {}} />);
    expect(screen.getByText("Notificaciones")).toBeTruthy();
    expect(screen.getByText("2 sin leer")).toBeTruthy();
    expect(screen.getByText("HOY")).toBeTruthy();
    expect(screen.getByText("AYER")).toBeTruthy();
    expect(screen.getByText("ANTERIORES")).toBeTruthy();
    expect(screen.getByText("Turno confirmado")).toBeTruthy();
    expect(screen.getByText("Hace 1 h")).toBeTruthy();
    expect(screen.getAllByLabelText("Sin leer")).toHaveLength(2);
    expect(screen.getByText("Borrar todas")).toBeTruthy();
  });

  it("sin avisos muestra el estado vacío y no ofrece borrar todas", async () => {
    await render(<PanelAvisos visible alCerrar={() => {}} avisos={[]} alBorrar={() => {}} alBorrarTodas={() => {}} />);
    expect(screen.getAllByText("Estás al día").length).toBeGreaterThan(0);
    expect(screen.getByText("Cuando tengas turnos, avisos o solicitudes, los vas a ver acá.")).toBeTruthy();
    expect(screen.queryByText("Borrar todas")).toBeNull();
  });

  it("borrar uno lo saca de la lista y avisa a quien llama", async () => {
    const alBorrar = jest.fn();
    const lista = avisos();
    await render(<PanelAvisos visible alCerrar={() => {}} avisos={lista} alBorrar={alBorrar} alBorrarTodas={() => {}} />);
    await fireEvent.press(screen.getAllByLabelText("Borrar la notificación")[0]);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(alBorrar).toHaveBeenCalledTimes(1);
    expect(alBorrar.mock.calls[0][0]).toBe(lista[0]);
    expect(screen.queryByText("Turno confirmado")).toBeNull();
    expect(screen.getByText("1 sin leer")).toBeTruthy();
  });

  it("borrar todas pide confirmación y vacía el panel", async () => {
    const alBorrarTodas = jest.fn();
    await render(<PanelAvisos visible alCerrar={() => {}} avisos={avisos()} alBorrar={() => {}} alBorrarTodas={alBorrarTodas} />);
    await fireEvent.press(screen.getByText("Borrar todas"));
    expect(screen.getByText("Borrar todas las notificaciones")).toBeTruthy();
    expect(screen.getByText("Esta acción no se puede deshacer.")).toBeTruthy();
    expect(alBorrarTodas).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Borrar"));
    expect(alBorrarTodas).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Turno confirmado")).toBeNull();
    expect(screen.getAllByText("Estás al día").length).toBeGreaterThan(0);
  });

  it("cancelar la confirmación no borra nada", async () => {
    const alBorrarTodas = jest.fn();
    await render(<PanelAvisos visible alCerrar={() => {}} avisos={avisos()} alBorrar={() => {}} alBorrarTodas={alBorrarTodas} />);
    await fireEvent.press(screen.getByText("Borrar todas"));
    await fireEvent.press(screen.getByText("Cancelar"));
    expect(alBorrarTodas).not.toHaveBeenCalled();
    expect(screen.getByText("Turno confirmado")).toBeTruthy();
  });
});

describe("TarjetaAviso", () => {
  it("sin alBorrar no muestra la cruz", async () => {
    await render(<TarjetaAviso tipo="MASCOTA" titulo="Mascota agregada" mensaje="Toby" creada={LocalDateTime.of(2026, 5, 20, 11, 59)} />);
    expect(screen.getByText("Mascota agregada")).toBeTruthy();
    expect(screen.getByText("Hace 1 min")).toBeTruthy();
    expect(screen.queryByLabelText("Borrar la notificación")).toBeNull();
    expect(screen.queryByLabelText("Sin leer")).toBeNull();
  });
});

describe("TarjetaPermiso", () => {
  it("no se dibuja si las notificaciones están permitidas", async () => {
    await render(<TarjetaPermiso />);
    await act(async () => {});
    expect(screen.queryByText("Las notificaciones del teléfono están desactivadas")).toBeNull();
  });

  it("avisa y ofrece activar si están apagadas", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(permisos(false));
    await render(<TarjetaPermiso />);
    await act(async () => {});
    expect(screen.getByText("Las notificaciones del teléfono están desactivadas")).toBeTruthy();
    expect(screen.getByText("Activalas para que te avisemos de tus turnos aunque la app esté cerrada.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activar" })).toBeTruthy();
  });
});
