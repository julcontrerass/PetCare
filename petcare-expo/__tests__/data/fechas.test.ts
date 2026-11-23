/* Migrado de app/src/test/.../FechasTest.kt. */
import { Fechas } from "../../src/util/fechas";
import { LocalDate, LocalDateTime } from "../../src/util/tiempo";

const iguales = (a: LocalDate | null, b: LocalDate) => expect(a?.equals(b)).toBe(true);

test("parsear_entiendeLosFormatosDeLaApp", () => {
  iguales(Fechas.parsear("15 Mar 2026"), LocalDate.of(2026, 3, 15));
  iguales(Fechas.parsear("15/03/2026"), LocalDate.of(2026, 3, 15));
  iguales(Fechas.parsear("08 ene 2020 (6 años)"), LocalDate.of(2020, 1, 8));
  expect(Fechas.parsear("mañana")).toBeNull();
  expect(Fechas.parsear(null)).toBeNull();
});

test("corta_yLarga", () => {
  expect(Fechas.corta(LocalDate.of(2026, 1, 5))).toBe("05 Ene 2026");
  expect(Fechas.larga(LocalDate.of(2026, 1, 5))).toBe("5 de enero de 2026");
});

test("relativa_hoyMananaAyer", () => {
  const hoy = LocalDate.of(2026, 5, 10);
  expect(Fechas.relativa(hoy, hoy)).toBe("Hoy");
  expect(Fechas.relativa(hoy.plusDays(1), hoy)).toBe("Mañana");
  expect(Fechas.relativa(hoy.minusDays(1), hoy)).toBe("Ayer");
  expect(Fechas.relativa(hoy.plusDays(10), hoy)).toBe("20 May 2026");
});

test("haceTexto_segunCuantoPaso", () => {
  const ahora = LocalDateTime.now();
  const hace = (minutos: number): string => {
    const momento = new Date(Date.now() - minutos * 60_000).toISOString();
    return Fechas.haceTexto(momento, ahora);
  };
  expect(hace(0)).toBe("Ahora");
  expect(hace(5)).toBe("Hace 5 min");
  expect(hace(60)).toBe("Hace 1 hora");
  expect(hace(180)).toBe("Hace 3 horas");
  expect(hace(24 * 60)).toBe("Ayer");
});
