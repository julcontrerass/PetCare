/*
 * Migrado de data/avisos/Recordatorios.kt.
 *
 * En Android se programaban con WorkManager; acá con expo-notifications (notificaciones locales con trigger de
 * fecha). La lógica que decide QUÉ avisar y CUÁNDO (`paraDueno`, `paraManuales`, `paraVacunas`, `paraMedicacion`,
 * `paraVeterinario`) es pura y no toca el sistema; `programar` es la única parte que habla con Expo.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Fechas } from "../../util/fechas";
import { LocalDate, LocalDateTime } from "../../util/tiempo";
import { EventoMascota } from "../../model/modelos";
import { Servicios } from "../servicios";
import { PacientesRepo } from "../repositorio/pacientesRepo";
import type { EventoVet } from "../repositorio/agendaRepo";
import { AvisosDelSistema } from "./avisosDelSistema";

const TIEMPO_VIGILANCIA_MS = 15 * 60 * 1000;
const DIAS_PARA_AVISAR_VENCIDAS = 90;
/** iOS no deja programar más de 64 notificaciones locales; en Android no hay tope. */
const MAXIMO_PROGRAMADAS_IOS = 60;

/** Un aviso a mostrar en [momento]. */
export class Aviso {
  constructor(
    readonly id: string,
    readonly momento: LocalDateTime,
    readonly titulo: string,
    readonly mensaje: string,
  ) {}
}

/** Un recordatorio hecho a mano: avisa el día elegido a su hora (a las 9 si no tiene). */
export class Manual {
  constructor(
    readonly id: string,
    readonly mascota: string,
    readonly titulo: string,
    readonly fecha: LocalDate,
    readonly hora: string | null,
    readonly nota: string,
  ) {}
}

/** Una vacuna con próxima dosis cargada. */
export class VacunaProxima {
  constructor(
    readonly id: string,
    readonly mascota: string,
    readonly vacuna: string,
    readonly proxima: LocalDate,
    /** Lo que es, para los textos del aviso: "vacuna" o "desparasitación". */
    readonly clase: string = "vacuna",
  ) {}
}

/** Una medicación en curso: toma cada [cadaHoras] desde [inicio] durante [dias]. */
export class Medicacion {
  constructor(
    readonly id: string,
    readonly mascota: string,
    readonly medicamento: string,
    readonly dosis: string,
    readonly cadaHoras: number,
    readonly inicio: LocalDateTime,
    readonly dias: number,
  ) {}
}

/** Hora ("09:30" o "09:30:00", como LocalTime.parse) a una fecha y hora; null si no se entiende. */
function inicio(fecha: LocalDate, hora: string): LocalDateTime | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hora);
  if (!m) return null;
  try {
    return LocalDateTime.of(fecha.year, fecha.monthValue, fecha.dayOfMonth, Number(m[1]), Number(m[2]), Number(m[3] ?? 0));
  } catch {
    return null;
  }
}

/** Segundos enteros desde [desde] hasta [hasta] (como Duration.between). */
function segundosEntre(desde: LocalDateTime, hasta: LocalDateTime): number {
  const dias = hasta.date.toEpochDay() - desde.date.toEpochDay();
  const segundosDelDia = (t: LocalDateTime) => t.hour * 3600 + t.minute * 60 + t.second;
  return dias * 86_400 + segundosDelDia(hasta) - segundosDelDia(desde);
}

const despues = (ahora: LocalDateTime) => (a: Aviso) => a.momento.isAfter(ahora);

/** Dueño: un día antes y dos horas antes de cada turno pendiente. */
function paraDueno(eventos: EventoMascota[], ahora: LocalDateTime = LocalDateTime.now()): Aviso[] {
  return eventos
    .filter((e) => e.estado === "PENDIENTE")
    .flatMap((e) => {
      const comienzo = inicio(e.fecha, e.hora);
      if (!comienzo) return [];
      const detalle = `${e.mascota}: ${e.categoria}` + (e.veterinario.trim() !== "" ? ` con ${e.veterinario}` : "");
      return [
        new Aviso(`${e.id}-dia`, comienzo.minusHours(24), "Mañana tenés un turno", `${detalle}, mañana a las ${e.hora} hs`),
        new Aviso(`${e.id}-horas`, comienzo.minusHours(2), "Tu turno es en 2 horas", `${detalle}, hoy a las ${e.hora} hs`),
      ];
    })
    .filter(despues(ahora));
}

function paraManuales(lista: Manual[], ahora: LocalDateTime = LocalDateTime.now()): Aviso[] {
  const avisos: Aviso[] = [];
  for (const m of lista) {
    const momento = inicio(m.fecha, m.hora ?? "09:00");
    if (!momento) continue;
    avisos.push(
      new Aviso(
        `${m.id}-manual`,
        momento,
        `Recordatorio: ${m.titulo}`,
        m.mascota + (m.nota.trim() !== "" ? ` · ${m.nota}` : ""),
      ),
    );
  }
  return avisos.filter(despues(ahora));
}

/**
 * Dueño: una semana antes y el día de cada próxima dosis, y un solo aviso (a las 10) por cada vacuna que ya
 * venció. [yaAvisadas] son los avisos de vencida que ya se mostraron.
 */
function paraVacunas(
  vacunas: VacunaProxima[],
  ahora: LocalDateTime = LocalDateTime.now(),
  yaAvisadas: Set<string> = new Set(),
): Aviso[] {
  const hoy = ahora.toLocalDate();
  return vacunas
    .flatMap((v) => {
      const fecha = Fechas.corta(v.proxima);
      const avisos: Aviso[] = [
        new Aviso(
          `${v.id}-vac-semana`,
          v.proxima.minusDays(7).atTime(10, 0),
          `Se acerca una ${v.clase}`,
          `${v.mascota}: ${v.vacuna} le toca el ${fecha} (en una semana)`,
        ),
        new Aviso(
          `${v.id}-vac-dia`,
          v.proxima.atTime(10, 0),
          `Hoy toca una ${v.clase}`,
          `${v.mascota}: ${v.vacuna}. Sacá un turno para aplicarla`,
        ),
      ];
      if (v.proxima.isBefore(hoy) && v.proxima.isAfter(hoy.minusDays(DIAS_PARA_AVISAR_VENCIDAS))) {
        const id = `${v.id}-vac-vencida-${v.proxima.toString()}`;
        if (!yaAvisadas.has(id)) {
          const dia = ahora.hour < 10 ? hoy : hoy.plusDays(1);
          avisos.push(
            new Aviso(
              id,
              dia.atTime(10, 0),
              `${v.clase.charAt(0).toUpperCase()}${v.clase.slice(1)} vencida`,
              `${v.mascota}: ${v.vacuna} está vencida desde el ${fecha}. Sacá un turno para ponerla al día`,
            ),
          );
        }
      }
      return avisos;
    })
    .filter(despues(ahora));
}

/** Dueño: las tomas de los próximos dos días de cada medicación indicada por el veterinario. */
function paraMedicacion(medicaciones: Medicacion[], ahora: LocalDateTime = LocalDateTime.now(), maximo: number = 48): Aviso[] {
  const todos = medicaciones.flatMap((m) => {
    if (m.cadaHoras <= 0) return [];
    const fin = m.inicio.plusDays(m.dias);
    const limite = ahora.plusHours(48);
    const pasadas = Math.max(0, Math.trunc(segundosEntre(m.inicio, ahora) / 60));
    const paso = m.cadaHoras * 60;
    let t = m.inicio.plusMinutes(Math.trunc((pasadas + paso - 1) / paso) * paso);
    if (!t.isAfter(ahora)) t = t.plusMinutes(paso);
    const tomas: Aviso[] = [];
    while (t.isBefore(fin) && t.isBefore(limite) && tomas.length < maximo) {
      const detalle = m.medicamento + (m.dosis.trim() !== "" ? ` (${m.dosis})` : "");
      tomas.push(new Aviso(`${m.id}-dosis-${t.toLocalDate().toString()}-${t.hour}-${t.minute}`, t, "Hora de la medicación", `${m.mascota}: ${detalle}`));
      t = t.plusMinutes(paso);
    }
    return tomas;
  });
  return todos.sort((a, b) => a.momento.compareTo(b.momento)).slice(0, maximo);
}

/** Veterinario: el resumen de las 8 de cada día con turnos y una hora antes de cada turno pendiente. */
function paraVeterinario(eventos: EventoVet[], ahora: LocalDateTime = LocalDateTime.now()): Aviso[] {
  const pendientes = eventos.filter((e) => e.estado === "PENDIENTE");
  const porHora = pendientes.flatMap((e) => {
    const comienzo = inicio(e.fecha, e.hora);
    if (!comienzo) return [];
    const paciente = PacientesRepo.nombreDe(e.pacienteId);
    return [new Aviso(`${e.id}-hora`, comienzo.minusHours(1), "Próximo turno en 1 hora", `${paciente} · ${e.motivo} a las ${e.hora} hs`)];
  });
  const porFecha = new Map<string, { fecha: LocalDate; cantidad: number }>();
  for (const e of pendientes) {
    const clave = e.fecha.toString();
    const actual = porFecha.get(clave);
    if (actual) actual.cantidad += 1;
    else porFecha.set(clave, { fecha: e.fecha, cantidad: 1 });
  }
  const resumenes = [...porFecha.values()].map(
    ({ fecha, cantidad }) =>
      new Aviso(
        `dia-${fecha.toString()}`,
        fecha.atTime(8, 0),
        "Tu agenda de hoy",
        cantidad === 1 ? "Tenés 1 turno hoy" : `Tenés ${cantidad} turnos hoy`,
      ),
  );
  return [...porHora, ...resumenes].filter(despues(ahora));
}

let vigilancia: ReturnType<typeof setInterval> | null = null;

/**
 * Avisa en el teléfono cuando se acerca la fecha de un turno, aunque la app esté cerrada. Cada vez que cambian los
 * turnos se vuelve a calcular todo y se reprograma, así lo cancelado o movido no avisa de más.
 */
export const Recordatorios = {
  Aviso,
  Manual,
  VacunaProxima,
  Medicacion,

  paraDueno,
  paraManuales,
  paraVacunas,
  paraMedicacion,
  paraVeterinario,

  /** Reemplaza los recordatorios programados por [avisos]. En la web no se programa nada. */
  async programar(avisos: Aviso[], ahora: LocalDateTime = LocalDateTime.now()): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!(await AvisosDelSistema.permitido())) return;
      await AvisosDelSistema.crearCanales();
      let lista = [...avisos].sort((a, b) => a.momento.compareTo(b.momento));
      if (Platform.OS === "ios") lista = lista.slice(0, MAXIMO_PROGRAMADAS_IOS);
      for (const aviso of lista) {
        const espera = Math.max(0, segundosEntre(ahora, aviso.momento) * 1000);
        const cuando = Date.now() + Math.max(espera, 1000);
        await Notifications.scheduleNotificationAsync({
          identifier: aviso.id,
          content: {
            title: aviso.titulo,
            body: aviso.mensaje,
            data: { clave: aviso.id },
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: cuando, channelId: AvisosDelSistema.CANAL_RECORDATORIOS },
        });
        // El aviso de vacuna vencida se da una sola vez: se anota para no volver a programarlo cuando ya salió
        if (aviso.id.includes("-vac-vencida-")) await AvisosDelSistema.registrarVencidaProgramada(aviso.id, cuando);
      }
    } catch {
      // un recordatorio que no se pudo programar no tiene que romper la pantalla
    }
  },

  /**
   * Revisa cada tanto si hay avisos nuevos del servidor. En Android esto corría con la app cerrada (WorkManager);
   * acá corre mientras la app está abierta, cada 15 minutos (con la app cerrada hace falta un servidor de push).
   */
  vigilarAvisos(): void {
    if (vigilancia) return;
    const t = setInterval(() => {
      void (async () => {
        try {
          if ((await Servicios.fuente.restaurarSesion()) != null) {
            await AvisosDelSistema.mostrarNuevas(await Servicios.fuente.notificaciones());
          }
        } catch {
          // se vuelve a intentar en la próxima vuelta
        }
      })();
    }, TIEMPO_VIGILANCIA_MS);
    (t as unknown as { unref?: () => void }).unref?.();
    vigilancia = t;
  },

  /** Cancela todo al cerrar la sesión: la cuenta que sigue no tiene que recibir los avisos de la anterior. */
  async cancelarTodo(): Promise<void> {
    if (vigilancia) {
      clearInterval(vigilancia);
      vigilancia = null;
    }
    if (Platform.OS === "web") return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // nada que cancelar
    }
  },
};
