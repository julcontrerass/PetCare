/* FiltroLineaTiempo: la regla (admite) y el componente. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { LocalDate } from "../../src/util/tiempo";
import {
  FILTRO_VACIO, filtroActivo, filtroAdmite, FiltroLineaTiempo, useFiltroLineaTiempo,
} from "../../src/ui/common/FiltroLineaTiempo";

const f = (dia: number) => LocalDate.of(2026, 5, dia);

describe("filtroAdmite", () => {
  it("sin filtros admite todo", () => {
    expect(filtroAdmite(FILTRO_VACIO, "cualquier cosa", "Vacuna", null)).toBe(true);
    expect(filtroActivo(FILTRO_VACIO)).toBe(false);
  });

  it("busca el texto sin distinguir mayúsculas y sin espacios en los bordes", () => {
    const e = { ...FILTRO_VACIO, consulta: "  AMOX " };
    expect(filtroAdmite(e, "Receta de amoxicilina", "Receta", f(1))).toBe(true);
    expect(filtroAdmite(e, "Antirrábica", "Vacuna", f(1))).toBe(false);
    expect(filtroActivo({ ...FILTRO_VACIO, consulta: "   " })).toBe(false);
  });

  it("filtra por tipo sin distinguir mayúsculas", () => {
    const e = { ...FILTRO_VACIO, tipo: "vacuna" };
    expect(filtroAdmite(e, "x", "Vacuna", f(1))).toBe(true);
    expect(filtroAdmite(e, "x", "Consulta", f(1))).toBe(false);
  });

  it("filtra por rango de fechas y descarta las filas sin fecha", () => {
    const e = { ...FILTRO_VACIO, desde: f(10), hasta: f(20) };
    expect(filtroAdmite(e, "x", "t", f(10))).toBe(true);
    expect(filtroAdmite(e, "x", "t", f(20))).toBe(true);
    expect(filtroAdmite(e, "x", "t", f(9))).toBe(false);
    expect(filtroAdmite(e, "x", "t", f(21))).toBe(false);
    expect(filtroAdmite(e, "x", "t", null)).toBe(false);
  });
});

const eventos = [
  { titulo: "Antirrábica", tipo: "Vacuna", fecha: f(5) },
  { titulo: "Control general", tipo: "Consulta", fecha: f(12) },
];

function Pantalla() {
  const filtro = useFiltroLineaTiempo();
  const visibles = eventos.filter((e) => filtro.admite(e.titulo, e.tipo, e.fecha));
  return (
    <>
      <FiltroLineaTiempo filtro={filtro} tipos={["Vacuna", "Consulta"]} />
      {visibles.map((e) => <Text key={e.titulo}>{e.titulo}</Text>)}
      {visibles.length === 0 ? <Text>{filtro.activo ? "Sin resultados" : "Sin eventos"}</Text> : null}
    </>
  );
}

describe("FiltroLineaTiempo", () => {
  it("el buscador y los chips filtran la lista y Limpiar la restaura", async () => {
    await render(<Pantalla />);
    expect(screen.getByText("Antirrábica")).toBeTruthy();
    expect(screen.getByText("Control general")).toBeTruthy();
    expect(screen.queryByText("Limpiar")).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText("Buscar en el historial"), "control");
    expect(screen.queryByText("Antirrábica")).toBeNull();
    expect(screen.getByText("Control general")).toBeTruthy();
    expect(screen.getByText("Limpiar")).toBeTruthy();

    await fireEvent.press(screen.getByText("Limpiar"));
    expect(screen.getByText("Antirrábica")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Vacuna" }));
    expect(screen.queryByText("Control general")).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText("Buscar en el historial"), "zzz");
    expect(screen.getByText("Sin resultados")).toBeTruthy();
  });

  it("los botones de fecha muestran la guía '—' hasta que se elige una", async () => {
    await render(<Pantalla />);
    expect(screen.getByText("Desde: —")).toBeTruthy();
    expect(screen.getByText("Hasta: —")).toBeTruthy();
  });
});
