/* EditorRecordatorio: crear, editar y validaciones. */
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RecordatoriosRepo } from "../../src/data/repositorio/recordatoriosRepo";
import { Avisos } from "../../src/ui/common/Avisos";
import { EditorRecordatorio } from "../../src/ui/common/EditorRecordatorio";
import { LocalDate, Reloj } from "../../src/util/tiempo";

beforeEach(async () => {
  prepararServicios();
  Avisos.reiniciar();
  Reloj.fijar(new Date(2026, 4, 20, 12, 0, 0));
  await ingresarComoDueno();
});
afterEach(() => {
  Reloj.fijar(null);
  Avisos.reiniciar();
  limpiarServicios();
});

const mascotas = [{ id: "m1", nombre: "Rex" }, { id: "m2", nombre: "Luna" }];

describe("EditorRecordatorio", () => {
  it("pide escribir qué recordar", async () => {
    const alGuardar = jest.fn();
    await render(<EditorRecordatorio visible alCerrar={() => {}} mascotas={mascotas} alGuardar={alGuardar} />);
    expect(screen.getByText("Nuevo recordatorio")).toBeTruthy();
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("Escribí qué querés recordar")).toBeTruthy();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it("crea un recordatorio para la mascota elegida", async () => {
    const alGuardar = jest.fn();
    const alCerrar = jest.fn();
    await render(<EditorRecordatorio visible alCerrar={alCerrar} mascotas={mascotas} alGuardar={alGuardar} />);
    await fireEvent.press(screen.getByRole("button", { name: "Luna" }));
    await fireEvent.press(screen.getByRole("button", { name: "Higiene" }));
    await fireEvent.changeText(screen.getByPlaceholderText("Ej.: Bañar a la mascota"), "  Bañar a Luna ");
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});

    expect(alGuardar).toHaveBeenCalledTimes(1);
    expect(alCerrar).toHaveBeenCalledTimes(1);
    const creado = RecordatoriosRepo.lista.find((r) => r.titulo === "Bañar a Luna");
    expect(creado).toBeDefined();
    expect(creado?.mascotaId).toBe("m2");
    expect(creado?.tipo).toBe("Higiene");
    expect(creado?.hora).toBeNull();
    expect(creado?.fecha.equals(LocalDate.of(2026, 5, 20))).toBe(true);
  });

  it("edita uno existente sin preguntar la mascota", async () => {
    const existente = RecordatoriosRepo.crear("m1", "Vacuna anual", "Vacuna", LocalDate.of(2026, 6, 1), "10:30", "nota");
    const alGuardar = jest.fn();
    await render(<EditorRecordatorio visible alCerrar={() => {}} mascotas={mascotas} existente={existente} alGuardar={alGuardar} />);
    expect(screen.getByText("Editar recordatorio")).toBeTruthy();
    expect(screen.queryByText("Mascota")).toBeNull();
    expect(screen.getByDisplayValue("Vacuna anual")).toBeTruthy();
    expect(screen.getByText("10:30 hs")).toBeTruthy();
    await fireEvent.changeText(screen.getByDisplayValue("Vacuna anual"), "Vacuna anual antirrábica");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(existente.titulo).toBe("Vacuna anual antirrábica");
    expect(alGuardar).toHaveBeenCalledTimes(1);
  });

  it("no deja una fecha anterior a hoy si se cambió, pero sí conservar la que ya tenía", async () => {
    const pasado = RecordatoriosRepo.crear("m1", "Viejo", "Otro", LocalDate.of(2026, 5, 1), null, "");
    const alGuardar = jest.fn();
    await render(<EditorRecordatorio visible alCerrar={() => {}} mascotas={mascotas} existente={pasado} alGuardar={alGuardar} />);
    await fireEvent.press(screen.getByText("Guardar"));
    expect(alGuardar).toHaveBeenCalledTimes(1);
  });

  it("sin mascotas avisa y se cierra", async () => {
    const alCerrar = jest.fn();
    await render(<EditorRecordatorio visible alCerrar={alCerrar} mascotas={[]} alGuardar={() => {}} />);
    expect(Avisos.estado.banner?.mensaje).toBe("Primero necesitás una mascota para crear un recordatorio");
    expect(alCerrar).toHaveBeenCalled();
  });
});
