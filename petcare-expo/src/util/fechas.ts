import { LocalDate, LocalDateTime, YearMonth } from "./tiempo";

const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesesLargos = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const dos = (n: number) => String(n).padStart(2, "0");

export const Fechas = {
  /** "15 Mar 2026". */
  corta(f: LocalDate): string {
    return `${dos(f.dayOfMonth)} ${meses[f.monthValue - 1]} ${f.year}`;
  },

  /** "Mayo 2026" a partir de una fecha o de un año-mes. */
  mesAnio(f: LocalDate | YearMonth): string {
    return `${mesesLargos[f.monthValue - 1]} ${f.year}`;
  },

  /** "MAR" a partir de una fecha, o "Mar" a partir del número de mes (1 a 12). */
  mesCorto(f: LocalDate | number): string {
    return typeof f === "number" ? meses[f - 1] : meses[f.monthValue - 1].toUpperCase();
  },

  /** "Mayo" a partir del número de mes (1 a 12). */
  nombreMes(mes: number): string {
    return mesesLargos[mes - 1];
  },

  diaSemana(f: LocalDate): string {
    return diasSemana[f.dayOfWeek - 1];
  },

  /** "15 de mayo de 2026". */
  larga(f: LocalDate): string {
    return `${f.dayOfMonth} de ${mesesLargos[f.monthValue - 1].toLowerCase()} de ${f.year}`;
  },

  /** Fecha tal como la guarda el servidor ("2026-03-15"); null si no hay o no se entiende. */
  iso(texto: string | null | undefined): LocalDate | null {
    if (!texto) return null;
    try {
      return LocalDate.parse(texto.slice(0, 10));
    } catch {
      return null;
    }
  },

  /** "15 Mar 2026" ("15 mar 2026" o "15/03/2026" también se entienden). */
  parsear(texto: string | null | undefined): LocalDate | null {
    if (texto == null) return null;
    const t = /(\d{1,2})\s+([A-Za-zñÑ]{3,})\.?\s+(\d{4})/.exec(texto);
    if (t) {
      const mes = t[2].toLowerCase().slice(0, 3);
      const indice = meses.findIndex((m) => m.toLowerCase() === mes);
      if (indice >= 0) {
        try {
          return LocalDate.of(Number(t[3]), indice + 1, Number(t[1]));
        } catch {
          return null;
        }
      }
    }
    const n = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texto);
    if (n) {
      try {
        return LocalDate.of(Number(n[3]), Number(n[2]), Number(n[1]));
      } catch {
        return null;
      }
    }
    return null;
  },

  relativa(f: LocalDate, hoy: LocalDate = LocalDate.now()): string {
    if (f.equals(hoy)) return "Hoy";
    if (f.equals(hoy.plusDays(1))) return "Mañana";
    if (f.equals(hoy.minusDays(1))) return "Ayer";
    return Fechas.corta(f);
  },

  /** Convierte la fecha con zona horaria que manda el servidor a la hora local del teléfono. */
  instante(texto: string | null | undefined): LocalDateTime {
    if (!texto) return LocalDateTime.now();
    // Postgres devuelve "2026-03-15 10:20:30.123+00": se lleva al formato ISO que entiende Date
    const iso = texto.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? LocalDateTime.now() : LocalDateTime.fromDate(d);
  },

  /** "Hace 5 min", "Hace 2 horas", "Ayer" o la fecha, según cuánto pasó. */
  haceTexto(texto: string | null | undefined, ahora: LocalDateTime = LocalDateTime.now()): string {
    const momento = Fechas.instante(texto);
    const minutos = Math.max(0, momento.minutosHasta(ahora));
    if (minutos < 1) return "Ahora";
    if (minutos < 60) return `Hace ${minutos} min`;
    if (minutos < 24 * 60) {
      const horas = Math.floor(minutos / 60);
      return `Hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
    }
    return Fechas.relativa(momento.toLocalDate(), ahora.toLocalDate());
  },
};
