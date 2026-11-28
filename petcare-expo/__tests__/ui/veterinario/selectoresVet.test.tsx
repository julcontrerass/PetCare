import { fireEvent, render, screen } from "@testing-library/react-native";
import { fijarRuta } from "../../soporte/rutas";
import { limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Avisos } from "../../../src/ui/common/Avisos";
import { PerfilVetRepo } from "../../../src/data/repositorio/perfilVetRepo";
import { LocalDate } from "../../../src/util/tiempo";
import { SelectorFechaVet, SelectorHoraVet } from "../../../src/ui/veterinario/SelectoresVet";
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

describe("SelectorFechaVet", () => {
  it("muestra los días de atención y la leyenda de los días en que no atiende", async () => {
    await render(<SelectorFechaVet visible inicial={null} alElegir={() => {}} alCerrar={() => {}} />);
    expect(screen.getByText("Elegí la fecha")).toBeTruthy();
    expect(screen.getByText("Atendés: Lun, Mar, Mié, Jue, Vie")).toBeTruthy();
    expect(screen.getByText("No atiende")).toBeTruthy();
    expect(screen.getByText("Noviembre 2026")).toBeTruthy();
  });

  it("un día en que no atiende avisa y no elige; uno en que sí atiende elige y cierra", async () => {
    const alElegir = jest.fn();
    const alCerrar = jest.fn();
    await render(<SelectorFechaVet visible inicial={null} alElegir={alElegir} alCerrar={alCerrar} />);
    // Sábado 28 de noviembre de 2026
    await fireEvent.press(screen.getByLabelText("28 de noviembre de 2026"));
    expect(Avisos.estado.banner?.mensaje).toBe("No atendés los sábado");
    expect(alElegir).not.toHaveBeenCalled();
    // Miércoles 25
    await fireEvent.press(screen.getByLabelText("25 de noviembre de 2026"));
    expect(alElegir).toHaveBeenCalledTimes(1);
    expect((alElegir.mock.calls[0][0] as LocalDate).equals(LocalDate.now().plusDays(2))).toBe(true);
    expect(alCerrar).toHaveBeenCalled();
  });

  it("con varios lugares nombra el lugar y usa los días del lugar elegido", async () => {
    const sede = { id: "s2", nombre: "Consultorio Centro", direccion: "", dias: [6], apertura: "10:00", cierre: "14:00", pausaDesde: null, pausaHasta: null };
    PerfilVetRepo.sedes.push({ id: "s1", nombre: "Clínica Sur", direccion: "", dias: [1, 2, 3, 4, 5], apertura: "09:00", cierre: "12:00", pausaDesde: null, pausaHasta: null }, sede);
    const alElegir = jest.fn();
    await render(<SelectorFechaVet visible sede={sede} alElegir={alElegir} alCerrar={() => {}} />);
    expect(screen.getByText("Atendés en Consultorio Centro: Sáb")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("28 de noviembre de 2026"));
    expect(alElegir).toHaveBeenCalledTimes(1);
  });
});

describe("SelectorHoraVet", () => {
  it("muestra el resumen, la grilla y tacha el horario ocupado por otro turno", async () => {
    // El turno t1 de hoy (10:00, 30 min) ocupa ese horario
    const alElegir = jest.fn();
    await render(<SelectorHoraVet visible fecha={LocalDate.now()} alElegir={alElegir} alCerrar={() => {}} />);
    expect(screen.getByText("Elegí el horario")).toBeTruthy();
    expect(screen.getByText("Hoy · 23 Nov 2026 · atendés de 09:00 a 12:00 hs · el turno dura 30 min")).toBeTruthy();
    expect(screen.getByLabelText("10:00, no disponible")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("10:00, no disponible"));
    expect(Avisos.estado.banner?.mensaje).toBe("Ese horario no está disponible");
    expect(alElegir).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("10:30"));
    expect(alElegir).toHaveBeenCalledWith("10:30");
  });

  it("ignorando el turno que se edita, su horario se puede volver a tomar", async () => {
    await render(<SelectorHoraVet visible fecha={LocalDate.now()} ignorarId="t1" horaActual="10:00" alElegir={() => {}} alCerrar={() => {}} />);
    expect(screen.queryByLabelText("10:00, no disponible")).toBeNull();
    expect(screen.getByLabelText("10:00")).toBeTruthy();
  });

  it("un día en que no atiende no tiene horarios libres", async () => {
    await render(<SelectorHoraVet visible fecha={LocalDate.of(2026, 11, 28)} alElegir={() => {}} alCerrar={() => {}} />);
    expect(screen.getByText("No quedan horarios libres para este día")).toBeTruthy();
  });
});
