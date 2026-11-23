/* Pruebas de humo de NotificacionesVetPanel y NotificacionesDuenoPanel. */
import { fuente, ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { NotificacionesVet } from "../../src/data/repositorio/notificacionesVet";
import type { NotificacionDto } from "../../src/data/remoto/dtos";
import { NotificacionesDuenoPanel } from "../../src/ui/common/NotificacionesDuenoPanel";
import { NotificacionesVetPanel } from "../../src/ui/common/NotificacionesVetPanel";

const ahora = new Date().toISOString();
const dto = (id: string, titulo: string, leida: boolean, tipo = "turno"): NotificacionDto => ({
  id, tipo, titulo, mensaje: `Mensaje de ${titulo}`, leida, created_at: ahora,
});

beforeEach(() => {
  prepararServicios();
});
afterEach(() => {
  NotificacionesVet.limpiar();
  limpiarServicios();
});

describe("NotificacionesVetPanel", () => {
  it("carga los avisos del servidor, los muestra y los marca como leídos", async () => {
    await ingresarComoVeterinario();
    fuente().notificacionesGuardadas = [dto("n1", "Turno nuevo", false), dto("n2", "Acceso aceptado", true, "acceso")];
    const alCambiar = jest.fn();
    await render(<NotificacionesVetPanel visible alCerrar={() => {}} alCambiar={alCambiar} />);
    await act(async () => {});

    expect(screen.getByText("Turno nuevo")).toBeTruthy();
    expect(screen.getByText("Acceso aceptado")).toBeTruthy();
    expect(screen.getByText("1 sin leer")).toBeTruthy(); // la foto previa a marcarlos
    expect(NotificacionesVet.sinLeer).toBe(0);
    expect(fuente().llamadas).toContain("notificacionesLeidas");
    expect(alCambiar).toHaveBeenCalled();
  });

  it("borrar todas vacía la lista del servidor", async () => {
    await ingresarComoVeterinario();
    fuente().notificacionesGuardadas = [dto("n1", "Turno nuevo", true)];
    await render(<NotificacionesVetPanel visible alCerrar={() => {}} />);
    await act(async () => {});
    await fireEvent.press(screen.getByText("Borrar todas"));
    await fireEvent.press(screen.getByText("Borrar"));
    await act(async () => {});
    expect(NotificacionesVet.lista).toHaveLength(0);
    expect(fuente().llamadas).toContain("notificacionesBorradas");
  });

  it("no muestra nada mientras no es visible", async () => {
    await ingresarComoVeterinario();
    await render(<NotificacionesVetPanel visible={false} alCerrar={() => {}} />);
    expect(screen.queryByText("Notificaciones")).toBeNull();
  });
});

describe("NotificacionesDuenoPanel", () => {
  it("muestra las del dueño, resalta las sin leer y las da por leídas", async () => {
    fuente().notificacionesGuardadas = [dto("d1", "Turno agendado", false), dto("d2", "Mascota agregada", true, "mascota")];
    await ingresarComoDueno();
    expect(DuenoRepo.notificacionesSinLeer).toBe(1);

    await render(<NotificacionesDuenoPanel visible alCerrar={() => {}} />);
    await act(async () => {});

    expect(screen.getByText("Turno agendado")).toBeTruthy();
    expect(screen.getByText("Mascota agregada")).toBeTruthy();
    expect(screen.getByText("1 sin leer")).toBeTruthy();
    expect(DuenoRepo.notificacionesSinLeer).toBe(0);
  });
});
