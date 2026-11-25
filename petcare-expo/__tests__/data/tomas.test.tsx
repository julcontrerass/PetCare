/* Tomas de medicación: cuáles tocan, tildarlas desde el Inicio y lo que ve el veterinario. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { PrescripcionesRepo } from "../../src/data/repositorio/prescripcionesRepo";
import { crearPrescripcion } from "../../src/model/clinica";
import { claveDeToma, cumplimiento, momentosDeTomas, tomaDeClave } from "../../src/model/tomas";
import { LocalDate, LocalDateTime, Reloj } from "../../src/util/tiempo";
import { RemediosDeHoy } from "../../src/ui/dueno/RemediosDeHoy";

const HOY = new Date(2026, 10, 24, 12, 0, 0); // 24/11/2026 12:00, hora local
let fuente: FuenteEnMemoria;

beforeEach(() => {
  Reloj.fijar(HOY);
  fuente = prepararServicios();
  fuente.mascotas.push(Escenario.mascota("m1", "Luna"));
  fuente.recetas.push({
    id: "r1", mascota_id: "m1", medicamento: "Amoxicilina", dosis: "250 mg", frecuencia_horas: 8, duracion_dias: 2,
    inicio: "2026-11-24", created_at: new Date(2026, 10, 24, 8, 0, 0).toISOString(),
  });
});
afterEach(() => {
  Reloj.fijar(null);
  limpiarServicios();
});

describe("modelo de tomas", () => {
  const receta = crearPrescripcion({
    id: "r", mascotaId: "m", medicamento: "X", frecuenciaHoras: 8, duracionDias: 2, creada: LocalDateTime.of(2026, 11, 24, 8, 0, 37),
  });

  it("una toma cada N horas desde que se recetó, durante los días indicados, sin segundos", () => {
    expect(momentosDeTomas(receta).map((t) => t.toString())).toEqual([
      "2026-11-24T08:00:00", "2026-11-24T16:00:00", "2026-11-25T00:00:00",
      "2026-11-25T08:00:00", "2026-11-25T16:00:00", "2026-11-26T00:00:00",
    ]);
  });

  it("sin frecuencia o sin duración no hay tomas", () => {
    expect(momentosDeTomas({ ...receta, frecuenciaHoras: null })).toEqual([]);
    expect(momentosDeTomas({ ...receta, duracionDias: null })).toEqual([]);
  });

  it("lee la hora que devuelve la base, con T o con espacio", () => {
    expect(tomaDeClave("2026-11-24 08:00:00")?.toString()).toBe("2026-11-24T08:00:00");
    expect(tomaDeClave("2026-11-24T16:00:00")?.toString()).toBe("2026-11-24T16:00:00");
    expect(tomaDeClave("cualquier cosa")).toBeNull();
  });

  it("cuenta las tomas dadas sobre las que ya tocaban", () => {
    const dadas = new Set([claveDeToma(LocalDateTime.of(2026, 11, 24, 8, 0))]);
    expect(cumplimiento(receta, dadas, LocalDateTime.of(2026, 11, 25, 9, 0))).toEqual({ dadas: 1, debidas: 4, total: 6 });
  });
});

describe("tomas del dueño", () => {
  it("lista las tomas de hoy y las tilda", async () => {
    await ingresarComoDueno();
    const hoy = DuenoRepo.tomasDelDia(LocalDate.of(2026, 11, 24));
    expect(hoy.map((t) => [t.momento.horaTexto(), t.mascota.nombre, t.dada])).toEqual([["08:00", "Luna", false], ["16:00", "Luna", false]]);

    DuenoRepo.marcarToma(hoy[0], true);
    expect(DuenoRepo.tomasDelDia(LocalDate.of(2026, 11, 24))[0].dada).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(fuente.llamadas).toContain("registrarToma:r1:2026-11-24T08:00:00");

    DuenoRepo.marcarToma(DuenoRepo.tomasDelDia(LocalDate.of(2026, 11, 24))[0], false);
    expect(DuenoRepo.tomasDelDia(LocalDate.of(2026, 11, 24))[0].dada).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(fuente.llamadas).toContain("quitarToma:r1:2026-11-24T08:00:00");
  });

  it("la tarjeta del Inicio muestra las tomas y se tilda tocándolas", async () => {
    await ingresarComoDueno();
    await render(<RemediosDeHoy />);
    expect(screen.getByText("Remedios de hoy")).toBeTruthy();
    expect(screen.getByText("0 de 2 tomas dadas. Tocá cada una cuando se la des.")).toBeTruthy();
    const primera = screen.getByRole("checkbox", { name: "08:00, Amoxicilina 250 mg para Luna" });
    expect(primera.props.accessibilityState.checked).toBe(false);
    // La de las 8 ya pasó y no se dio: queda pendiente; la de las 16, para más tarde
    expect(screen.getByText("Pendiente")).toBeTruthy();
    expect(screen.getByText("Más tarde")).toBeTruthy();
    await fireEvent.press(primera);
    expect(fuente.llamadas.some((l) => l.startsWith("registrarToma:r1:2026-11-24T08:00:00"))).toBe(true);
  });

  it("sin recetas en curso la tarjeta no aparece", async () => {
    fuente.recetas = [];
    await ingresarComoDueno();
    await render(<RemediosDeHoy />);
    expect(screen.queryByText("Remedios de hoy")).toBeNull();
  });
});

describe("tomas en la receta del veterinario", () => {
  it("cuenta las tomas que tildó el dueño", async () => {
    fuente.tomasGuardadas.push({ id: "t1", prescripcion_id: "r1", mascota_id: "m1", programada: "2026-11-24 08:00:00", dada_at: "2026-11-24T11:05:00Z" });
    await PrescripcionesRepo.cargar("m1");
    const receta = PrescripcionesRepo.deMascota("m1")[0];
    expect(PrescripcionesRepo.cumplimientoDe(receta)).toEqual({ dadas: 1, debidas: 1, total: 6 });
  });
});
