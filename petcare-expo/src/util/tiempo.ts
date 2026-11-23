/**
 * Fechas y horas sin zona horaria, con la misma forma que java.time (LocalDate, LocalDateTime, YearMonth, Period).
 * Son inmutables y se comparan con equals/compareTo, nunca con ===.
 */

let relojFijo: Date | null = null;

/** Las pruebas fijan "ahora" para que los resultados no dependan del día en que corren. */
export const Reloj = {
  fijar(momento: Date | null) {
    relojFijo = momento;
  },
  ahora(): Date {
    return relojFijo ? new Date(relojFijo.getTime()) : new Date();
  },
};

const pad = (n: number, largo = 2) => String(n).padStart(largo, "0");

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

const MS_DIA = 86_400_000;

export class LocalDate {
  private constructor(
    readonly year: number,
    readonly monthValue: number,
    readonly dayOfMonth: number,
  ) {}

  static of(anio: number, mes: number, dia: number): LocalDate {
    if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
      throw new Error(`Fecha inválida: ${anio}-${mes}-${dia}`);
    }
    if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
      throw new Error(`Fecha inválida: ${anio}-${mes}-${dia}`);
    }
    return new LocalDate(anio, mes, dia);
  }

  /** "2026-03-15" (si trae hora o zona, se ignora). Falla si no se entiende. */
  static parse(texto: string): LocalDate {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
    if (!m) throw new Error(`Fecha inválida: ${texto}`);
    return LocalDate.of(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  static now(): LocalDate {
    const d = Reloj.ahora();
    return LocalDate.of(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  static ofEpochDay(dias: number): LocalDate {
    const d = new Date(dias * MS_DIA);
    return LocalDate.of(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  toEpochDay(): number {
    return Math.round(Date.UTC(this.year, this.monthValue - 1, this.dayOfMonth) / MS_DIA);
  }

  /** 1 = lunes ... 7 = domingo. */
  get dayOfWeek(): number {
    const d = new Date(Date.UTC(this.year, this.monthValue - 1, this.dayOfMonth)).getUTCDay();
    return d === 0 ? 7 : d;
  }

  plusDays(n: number): LocalDate {
    return LocalDate.ofEpochDay(this.toEpochDay() + n);
  }
  minusDays(n: number): LocalDate {
    return this.plusDays(-n);
  }
  plusWeeks(n: number): LocalDate {
    return this.plusDays(7 * n);
  }
  minusWeeks(n: number): LocalDate {
    return this.plusDays(-7 * n);
  }

  plusMonths(n: number): LocalDate {
    const total = this.year * 12 + (this.monthValue - 1) + n;
    const anio = Math.floor(total / 12);
    const mes = total - anio * 12 + 1;
    return LocalDate.of(anio, mes, Math.min(this.dayOfMonth, diasDelMes(anio, mes)));
  }
  minusMonths(n: number): LocalDate {
    return this.plusMonths(-n);
  }
  plusYears(n: number): LocalDate {
    return this.plusMonths(12 * n);
  }
  minusYears(n: number): LocalDate {
    return this.plusMonths(-12 * n);
  }

  withDayOfMonth(dia: number): LocalDate {
    return LocalDate.of(this.year, this.monthValue, dia);
  }

  lengthOfMonth(): number {
    return diasDelMes(this.year, this.monthValue);
  }

  yearMonth(): YearMonth {
    return YearMonth.of(this.year, this.monthValue);
  }

  atTime(hora: number, minuto = 0, segundo = 0): LocalDateTime {
    return LocalDateTime.of(this.year, this.monthValue, this.dayOfMonth, hora, minuto, segundo);
  }

  compareTo(otra: LocalDate): number {
    return this.toEpochDay() - otra.toEpochDay();
  }
  isBefore(otra: LocalDate): boolean {
    return this.compareTo(otra) < 0;
  }
  isAfter(otra: LocalDate): boolean {
    return this.compareTo(otra) > 0;
  }
  equals(otra: LocalDate | null | undefined): boolean {
    return !!otra && this.compareTo(otra) === 0;
  }

  toString(): string {
    return `${pad(this.year, 4)}-${pad(this.monthValue)}-${pad(this.dayOfMonth)}`;
  }
}

export class YearMonth {
  private constructor(
    readonly year: number,
    readonly monthValue: number,
  ) {}

  static of(anio: number, mes: number): YearMonth {
    if (mes < 1 || mes > 12) throw new Error(`Mes inválido: ${mes}`);
    return new YearMonth(anio, mes);
  }
  static now(): YearMonth {
    return LocalDate.now().yearMonth();
  }
  atDay(dia: number): LocalDate {
    return LocalDate.of(this.year, this.monthValue, dia);
  }
  atEndOfMonth(): LocalDate {
    return this.atDay(this.lengthOfMonth());
  }
  lengthOfMonth(): number {
    return diasDelMes(this.year, this.monthValue);
  }
  plusMonths(n: number): YearMonth {
    const total = this.year * 12 + (this.monthValue - 1) + n;
    const anio = Math.floor(total / 12);
    return new YearMonth(anio, total - anio * 12 + 1);
  }
  minusMonths(n: number): YearMonth {
    return this.plusMonths(-n);
  }
  compareTo(otro: YearMonth): number {
    return this.year * 12 + this.monthValue - (otro.year * 12 + otro.monthValue);
  }
  isBefore(otro: YearMonth): boolean {
    return this.compareTo(otro) < 0;
  }
  isAfter(otro: YearMonth): boolean {
    return this.compareTo(otro) > 0;
  }
  equals(otro: YearMonth | null | undefined): boolean {
    return !!otro && this.compareTo(otro) === 0;
  }
  toString(): string {
    return `${pad(this.year, 4)}-${pad(this.monthValue)}`;
  }
}

export class LocalDateTime {
  private constructor(
    readonly date: LocalDate,
    readonly hour: number,
    readonly minute: number,
    readonly second: number,
  ) {}

  static of(anio: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0): LocalDateTime {
    if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59 || segundo < 0 || segundo > 59) {
      throw new Error(`Hora inválida: ${hora}:${minuto}:${segundo}`);
    }
    return new LocalDateTime(LocalDate.of(anio, mes, dia), hora, minuto, segundo);
  }

  static ofDate(fecha: LocalDate, hora = 0, minuto = 0, segundo = 0): LocalDateTime {
    return new LocalDateTime(fecha, hora, minuto, segundo);
  }

  static now(): LocalDateTime {
    return LocalDateTime.fromDate(Reloj.ahora());
  }

  /** La hora local del teléfono para ese instante. */
  static fromDate(d: Date): LocalDateTime {
    return LocalDateTime.of(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  }

  get year() {
    return this.date.year;
  }
  get monthValue() {
    return this.date.monthValue;
  }
  get dayOfMonth() {
    return this.date.dayOfMonth;
  }

  toLocalDate(): LocalDate {
    return this.date;
  }

  /** "09:30". */
  horaTexto(): string {
    return `${pad(this.hour)}:${pad(this.minute)}`;
  }

  /** Milisegundos desde el 1/1/1970 tomando la fecha como hora local del teléfono. */
  toEpochMillis(): number {
    return new Date(this.year, this.monthValue - 1, this.dayOfMonth, this.hour, this.minute, this.second).getTime();
  }

  toDate(): Date {
    return new Date(this.toEpochMillis());
  }

  private minutosDesdeInicioDelDia(): number {
    return this.hour * 60 + this.minute;
  }

  plusMinutes(n: number): LocalDateTime {
    const total = this.minutosDesdeInicioDelDia() + n;
    const dias = Math.floor(total / 1440);
    const resto = total - dias * 1440;
    return new LocalDateTime(this.date.plusDays(dias), Math.floor(resto / 60), resto % 60, this.second);
  }
  minusMinutes(n: number): LocalDateTime {
    return this.plusMinutes(-n);
  }
  plusHours(n: number): LocalDateTime {
    return this.plusMinutes(60 * n);
  }
  minusHours(n: number): LocalDateTime {
    return this.plusMinutes(-60 * n);
  }
  plusDays(n: number): LocalDateTime {
    return new LocalDateTime(this.date.plusDays(n), this.hour, this.minute, this.second);
  }
  minusDays(n: number): LocalDateTime {
    return this.plusDays(-n);
  }

  /** Minutos enteros que faltan desde esta hora hasta [otra] (negativo si [otra] es anterior). */
  minutosHasta(otra: LocalDateTime): number {
    const dif = (otra.date.toEpochDay() - this.date.toEpochDay()) * 1440 + (otra.minutosDesdeInicioDelDia() - this.minutosDesdeInicioDelDia());
    return dif;
  }

  compareTo(otra: LocalDateTime): number {
    const d = this.date.compareTo(otra.date);
    if (d !== 0) return d;
    return (this.hour - otra.hour) * 3600 + (this.minute - otra.minute) * 60 + (this.second - otra.second);
  }
  isBefore(otra: LocalDateTime): boolean {
    return this.compareTo(otra) < 0;
  }
  isAfter(otra: LocalDateTime): boolean {
    return this.compareTo(otra) > 0;
  }
  equals(otra: LocalDateTime | null | undefined): boolean {
    return !!otra && this.compareTo(otra) === 0;
  }

  toString(): string {
    return `${this.date.toString()}T${pad(this.hour)}:${pad(this.minute)}:${pad(this.second)}`;
  }
}

/** Años, meses y días completos entre dos fechas (como java.time.Period.between). */
export function periodoEntre(desde: LocalDate, hasta: LocalDate): { years: number; months: number; days: number; isNegative: boolean } {
  let totalMeses = hasta.year * 12 + hasta.monthValue - (desde.year * 12 + desde.monthValue);
  let dias = hasta.dayOfMonth - desde.dayOfMonth;
  if (totalMeses > 0 && dias < 0) {
    totalMeses -= 1;
    dias = hasta.toEpochDay() - desde.plusMonths(totalMeses).toEpochDay();
  } else if (totalMeses < 0 && dias > 0) {
    totalMeses += 1;
    dias -= hasta.lengthOfMonth();
  }
  const anios = Math.trunc(totalMeses / 12);
  const meses = totalMeses % 12;
  return { years: anios, months: meses, days: dias, isNegative: anios < 0 || meses < 0 || dias < 0 };
}

/** Días entre dos fechas (negativo si [hasta] es anterior). */
export function diasEntre(desde: LocalDate, hasta: LocalDate): number {
  return hasta.toEpochDay() - desde.toEpochDay();
}

/** Hora "09:30" o "09:30:00" como minutos desde las 00:00; null si no se entiende. */
export function minutosDeHora(hora: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function horaDesdeMinutos(minutos: number): string {
  return `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`;
}
