import { Fechas } from "../src/util/fechas";
import { LocalDate, LocalDateTime, periodoEntre, YearMonth } from "../src/util/tiempo";

describe("LocalDate", () => {
  it("suma días y meses sin pasarse del fin de mes", () => {
    expect(LocalDate.of(2026, 1, 31).plusMonths(1).toString()).toBe("2026-02-28");
    expect(LocalDate.of(2026, 12, 31).plusDays(1).toString()).toBe("2027-01-01");
    expect(LocalDate.of(2026, 3, 1).minusDays(1).toString()).toBe("2026-02-28");
  });
  it("calcula el día de la semana (1 = lunes)", () => {
    expect(LocalDate.of(2026, 5, 18).dayOfWeek).toBe(1);
    expect(LocalDate.of(2026, 5, 24).dayOfWeek).toBe(7);
  });
  it("rechaza fechas inexistentes", () => {
    expect(() => LocalDate.of(2026, 2, 30)).toThrow();
    expect(() => LocalDate.parse("hola")).toThrow();
  });
  it("compara por valor", () => {
    expect(LocalDate.of(2026, 5, 1).equals(LocalDate.parse("2026-05-01T10:00:00Z"))).toBe(true);
    expect(LocalDate.of(2026, 5, 1).isBefore(LocalDate.of(2026, 5, 2))).toBe(true);
  });
});

describe("periodoEntre", () => {
  it("cuenta años y meses completos", () => {
    const p = periodoEntre(LocalDate.of(2020, 3, 15), LocalDate.of(2026, 3, 14));
    expect(p.years).toBe(5);
    expect(p.months).toBe(11);
    const q = periodoEntre(LocalDate.of(2026, 1, 31), LocalDate.of(2026, 3, 1));
    expect(q.months).toBe(1);
    expect(periodoEntre(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 4, 1)).isNegative).toBe(true);
  });
});

describe("LocalDateTime", () => {
  it("suma minutos cruzando la medianoche", () => {
    const t = LocalDateTime.of(2026, 5, 1, 23, 30).plusMinutes(45);
    expect(t.toString()).toBe("2026-05-02T00:15:00");
    expect(LocalDateTime.of(2026, 5, 1, 10, 0).minutosHasta(LocalDateTime.of(2026, 5, 1, 11, 30))).toBe(90);
  });
});

describe("Fechas", () => {
  it("da formato a las fechas", () => {
    expect(Fechas.corta(LocalDate.of(2026, 3, 5))).toBe("05 Mar 2026");
    expect(Fechas.larga(LocalDate.of(2026, 5, 15))).toBe("15 de mayo de 2026");
    expect(Fechas.mesAnio(YearMonth.of(2026, 5))).toBe("Mayo 2026");
    expect(Fechas.relativa(LocalDate.of(2026, 5, 2), LocalDate.of(2026, 5, 1))).toBe("Mañana");
  });
  it("entiende las fechas escritas", () => {
    expect(Fechas.parsear("15 Mar 2026")?.toString()).toBe("2026-03-15");
    expect(Fechas.parsear("15/03/2026")?.toString()).toBe("2026-03-15");
    expect(Fechas.parsear("nada")).toBeNull();
    expect(Fechas.iso("2026-03-15T10:00:00+00:00")?.toString()).toBe("2026-03-15");
  });
});
