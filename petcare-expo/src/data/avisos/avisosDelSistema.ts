/*
 * Migrado de data/avisos/AvisosDelSistema.kt.
 *
 * En Android las notificaciones se armaban con NotificationCompat y las preferencias con SharedPreferences;
 * acá se usa expo-notifications (canales, permiso y notificaciones inmediatas) y AsyncStorage (lo que ya se
 * mostró). Como AsyncStorage y expo-notifications son asincrónicos, las funciones que antes eran sincrónicas
 * y recibían el `Context` ahora devuelven una promesa y no reciben contexto.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AppState, Linking, Platform } from "react-native";
import { Colores } from "../../theme/colores";
import { Fechas } from "../../util/fechas";
import { LocalDateTime } from "../../util/tiempo";
import type { NotificacionDto } from "../remoto/dtos";

const CANAL_AVISOS = "avisos";
const CANAL_RECORDATORIOS = "recordatorios";

/** Claves de AsyncStorage: el equivalente del archivo `petcare_avisos_sistema` de SharedPreferences. */
const ARCHIVO = "petcare_avisos_sistema";
const CLAVE_VISTOS = `${ARCHIVO}.vistos`;
const CLAVE_VACUNAS_AVISADAS = `${ARCHIVO}.vacunas_avisadas`;
/** Avisos de vacuna vencida ya programados y la hora a la que suenan (ver [AvisosDelSistema.registrarVencidaProgramada]). */
const CLAVE_VENCIDAS_PROGRAMADAS = `${ARCHIVO}.vencidas_programadas`;
const MAXIMO_VISTOS = 300;

/** Solo se avisa de lo que pasó en las últimas horas: lo más viejo ya lo vio el usuario dentro de la app. */
const ANTIGUEDAD_MAXIMA_SEGUNDOS = 24 * 3600;

const esWeb = Platform.OS === "web";

/** La API `Notification` del navegador (solo existe en la web y sirve con la pestaña abierta). */
interface NotificacionWeb {
  permission: string;
  requestPermission(): Promise<string>;
}
function notificacionWeb(): NotificacionWeb | null {
  const global = globalThis as unknown as { Notification?: NotificacionWeb };
  return global.Notification ?? null;
}

/** Segundos enteros desde [desde] hasta [hasta] (como Duration.between). */
function segundosEntre(desde: LocalDateTime, hasta: LocalDateTime): number {
  const dias = hasta.date.toEpochDay() - desde.date.toEpochDay();
  const segundosDelDia = (t: LocalDateTime) => t.hour * 3600 + t.minute * 60 + t.second;
  return dias * 86_400 + segundosDelDia(hasta) - segundosDelDia(desde);
}

async function leerLista(clave: string): Promise<string[]> {
  try {
    const texto = await AsyncStorage.getItem(clave);
    if (!texto) return [];
    const valor: unknown = JSON.parse(texto);
    return Array.isArray(valor) ? valor.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function guardarLista(clave: string, lista: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(clave, JSON.stringify(lista));
  } catch {
    // si no se puede guardar, lo peor que pasa es que un aviso se repita
  }
}

/** Sin duplicados y con solo los últimos [MAXIMO_VISTOS], para que la lista no crezca sin límite. */
function recortar(ids: Iterable<string>): string[] {
  const unicos = [...new Set(ids)];
  return unicos.length > MAXIMO_VISTOS ? unicos.slice(unicos.length - MAXIMO_VISTOS) : unicos;
}

/**
 * Las notificaciones que el teléfono muestra fuera de la app: avisos del servidor (turno nuevo, cambio,
 * cancelación, turno finalizado) y recordatorios de que se acerca un turno.
 */
class AvisosDelSistemaImpl {
  readonly CANAL_AVISOS = CANAL_AVISOS;
  readonly CANAL_RECORDATORIOS = CANAL_RECORDATORIOS;

  /**
   * Con la app abierta se muestra un aviso dentro de la pantalla en lugar de una notificación del sistema. La
   * interfaz (o `iniciarApp`) lo configura; es el equivalente de `Avisos.mostrar(null, mensaje)`.
   */
  alAvisarEnPantalla: ((mensaje: string) => void) | null = null;

  /** True si la app está a la vista (el equivalente de `Avisos.enPrimerPlano`). Las pruebas lo reemplazan. */
  enPrimerPlano: () => boolean = () => AppState.currentState === "active";

  /** Los trabajos de lectura y escritura de lo ya visto se hacen de a uno, para que no se pisen. */
  private cola: Promise<unknown> = Promise.resolve();

  private enCola<T>(trabajo: () => Promise<T>): Promise<T> {
    const siguiente = this.cola.then(trabajo, trabajo);
    this.cola = siguiente.catch(() => undefined);
    return siguiente;
  }

  /** Crea los canales de notificación de Android (en otras plataformas no hace nada). */
  async crearCanales(): Promise<void> {
    if (Platform.OS !== "android") return;
    try {
      await Notifications.setNotificationChannelAsync(CANAL_AVISOS, {
        name: "Avisos de turnos",
        importance: Notifications.AndroidImportance.HIGH,
        description: "Turnos nuevos, cambios, cancelaciones y turnos finalizados",
      });
      await Notifications.setNotificationChannelAsync(CANAL_RECORDATORIOS, {
        name: "Recordatorios",
        importance: Notifications.AndroidImportance.HIGH,
        description: "Aviso cuando se acerca la fecha de un turno",
      });
    } catch {
      // sin canales las notificaciones usan el canal por defecto
    }
  }

  /** True si el usuario permitió las notificaciones (en Android 13 o más hay que pedirlo). */
  async permitido(): Promise<boolean> {
    if (esWeb) return notificacionWeb()?.permission === "granted";
    try {
      const permisos = await Notifications.getPermissionsAsync();
      return permisos.granted;
    } catch {
      return false;
    }
  }

  /** Pide el permiso de notificaciones (el diálogo del sistema) y devuelve si quedó concedido. */
  async pedirPermiso(): Promise<boolean> {
    if (esWeb) {
      try {
        return (await notificacionWeb()?.requestPermission()) === "granted";
      } catch {
        return false;
      }
    }
    try {
      const permisos = await Notifications.requestPermissionsAsync();
      return permisos.granted;
    } catch {
      return false;
    }
  }

  /** Muestra una notificación ahora mismo. [id] reemplaza a otra con el mismo id. */
  async mostrar(id: string, titulo: string, mensaje: string, canal: string = CANAL_AVISOS): Promise<void> {
    if (!(await this.permitido())) return;
    if (esWeb) {
      // En la web no hay notificaciones del sistema programadas: solo la API del navegador, con la pestaña abierta
      try {
        const Constructor = (globalThis as unknown as { Notification?: new (t: string, o: { body: string; tag: string }) => unknown })
          .Notification;
        if (Constructor) new Constructor(titulo, { body: mensaje, tag: id });
      } catch {
        // el navegador puede negarse a mostrarla
      }
      return;
    }
    await this.crearCanales();
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: titulo,
          body: mensaje,
          color: Colores.primaryTeal,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          sound: true,
        },
        trigger: { channelId: canal },
      });
    } catch {
      // una notificación que no se pudo mostrar no rompe nada
    }
  }

  /**
   * Avisa de las notificaciones del servidor que todavía no se mostraron. Con [silencioso] solo se marcan como
   * vistas (al iniciar sesión no tiene sentido sonar por lo que ya estaba). Con la app abierta se muestra un
   * aviso dentro de la pantalla en lugar de una notificación del sistema.
   */
  mostrarNuevas(
    avisos: NotificacionDto[],
    silencioso: boolean = false,
    ahora: LocalDateTime = LocalDateTime.now(),
  ): Promise<void> {
    return this.enCola(async () => {
      const ya = await leerLista(CLAVE_VISTOS);
      const vistos = new Set(ya);
      const nuevos = avisos.filter((a) => !vistos.has(a.id));
      if (nuevos.length === 0) return;
      await guardarLista(CLAVE_VISTOS, recortar([...ya, ...nuevos.map((a) => a.id)]));
      if (silencioso) return;
      const recientes = nuevos.filter(
        (a) => !a.leida && segundosEntre(Fechas.instante(a.created_at), ahora) <= ANTIGUEDAD_MAXIMA_SEGUNDOS,
      );
      for (const aviso of recientes) {
        if (this.enPrimerPlano()) {
          this.alAvisarEnPantalla?.(`${aviso.titulo}: ${aviso.mensaje}`);
        } else {
          await this.mostrar(aviso.id, aviso.titulo, aviso.mensaje, CANAL_AVISOS);
        }
      }
    });
  }

  /**
   * Los avisos de "vacuna vencida" que ya salieron, para no repetirlos. Incluye los que se programaron y cuya
   * hora ya pasó (en Android el trabajo anotaba el aviso al mostrarlo; acá la app puede estar cerrada a esa hora).
   */
  vacunasAvisadas(): Promise<Set<string>> {
    return this.enCola(async () => {
      const avisadas = await leerLista(CLAVE_VACUNAS_AVISADAS);
      const programadas = await this.leerVencidasProgramadas();
      const ahora = Date.now();
      const vencidas = Object.keys(programadas).filter((id) => programadas[id] <= ahora);
      if (vencidas.length === 0) return new Set(avisadas);
      const todas = recortar([...avisadas, ...vencidas]);
      await guardarLista(CLAVE_VACUNAS_AVISADAS, todas);
      for (const id of vencidas) delete programadas[id];
      await this.guardarVencidasProgramadas(programadas);
      return new Set(todas);
    });
  }

  /** Anota que el aviso de vacuna vencida [id] ya salió. */
  marcarVacunaAvisada(id: string): Promise<void> {
    return this.enCola(async () => {
      const avisadas = await leerLista(CLAVE_VACUNAS_AVISADAS);
      await guardarLista(CLAVE_VACUNAS_AVISADAS, recortar([...avisadas, id]));
    });
  }

  /**
   * Anota que el aviso de vacuna vencida [id] quedó programado para [momentoMs] (milisegundos). Con la app
   * cerrada no hay código que se ejecute al mostrarse la notificación, así que se lo da por avisado cuando
   * pasa esa hora (ver [vacunasAvisadas]).
   */
  registrarVencidaProgramada(id: string, momentoMs: number): Promise<void> {
    return this.enCola(async () => {
      const programadas = await this.leerVencidasProgramadas();
      programadas[id] = momentoMs;
      await this.guardarVencidasProgramadas(programadas);
    });
  }

  private async leerVencidasProgramadas(): Promise<Record<string, number>> {
    try {
      const texto = await AsyncStorage.getItem(CLAVE_VENCIDAS_PROGRAMADAS);
      if (!texto) return {};
      const valor: unknown = JSON.parse(texto);
      const resultado: Record<string, number> = {};
      if (valor && typeof valor === "object") {
        for (const [clave, ms] of Object.entries(valor)) if (typeof ms === "number") resultado[clave] = ms;
      }
      return resultado;
    } catch {
      return {};
    }
  }

  private async guardarVencidasProgramadas(programadas: Record<string, number>): Promise<void> {
    try {
      await AsyncStorage.setItem(CLAVE_VENCIDAS_PROGRAMADAS, JSON.stringify(programadas));
    } catch {
      // ver guardarLista
    }
  }

  /** Abre los ajustes de notificaciones de la app en el teléfono, para activarlas a mano. */
  async abrirAjustes(): Promise<void> {
    if (esWeb) return; // en la web los permisos se cambian desde el candado del navegador
    try {
      await Linking.openSettings();
    } catch {
      // no hay nada más que hacer si el sistema no abre los ajustes
    }
  }

  /** Olvida lo que se había mostrado (al cerrar sesión). */
  olvidar(): Promise<void> {
    return this.enCola(async () => {
      try {
        await AsyncStorage.multiRemove([CLAVE_VISTOS, CLAVE_VACUNAS_AVISADAS, CLAVE_VENCIDAS_PROGRAMADAS]);
      } catch {
        // ver guardarLista
      }
    });
  }
}

export const AvisosDelSistema = new AvisosDelSistemaImpl();
