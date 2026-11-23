import { Errores } from "../util/errores";
import type { FuenteDatos } from "./remoto/fuenteDatos";

type Oyente = () => void;

/**
 * Punto de acceso a lo que comparte toda la app: la fuente de datos (Supabase), el aviso de cambios y el
 * aviso de errores. Los repositorios guardan una copia en memoria de lo que ve el usuario y mandan los
 * cambios al servidor sin bloquear la pantalla.
 */
class ServiciosImpl {
  private fuenteReal: FuenteDatos | null = null;
  private oyentes = new Set<Oyente>();
  private version = 0;

  /** Las pruebas reemplazan la fuente por una en memoria. */
  fuentePrueba: FuenteDatos | null = null;

  /** La interfaz se anota acá para mostrar los errores de las escrituras en segundo plano. */
  alMostrarError: ((mensaje: string) => void) | null = null;

  get fuente(): FuenteDatos {
    if (this.fuentePrueba) return this.fuentePrueba;
    if (!this.fuenteReal) {
      // Se carga recién al usarla: en las pruebas no hace falta el cliente real
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SupabaseFuente } = require("./remoto/supabaseFuente") as typeof import("./remoto/supabaseFuente");
      this.fuenteReal = new SupabaseFuente();
    }
    return this.fuenteReal;
  }

  /** Quien quiera enterarse de que los datos cambiaron en segundo plano (la pantalla visible) se anota acá. */
  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    return () => {
      this.oyentes.delete(oyente);
    };
  }

  /** Número que sube con cada cambio: sirve para que React vuelva a dibujar las pantallas. */
  get versionDatos(): number {
    return this.version;
  }

  avisarCambio(): void {
    this.version += 1;
    for (const oyente of [...this.oyentes]) oyente();
  }

  mostrarError(mensaje: string): void {
    this.alMostrarError?.(mensaje);
  }

  /**
   * Manda un cambio al servidor. La pantalla ya mostró el resultado; si el servidor lo rechaza se avisa y
   * [alFallar] vuelve a pedir los datos para que la copia local no quede distinta de la real.
   */
  escribir(
    opciones: { alFallar?: () => Promise<void>; alTerminar?: () => Promise<void> },
    accion: () => Promise<void>,
  ): Promise<void>;
  escribir(accion: () => Promise<void>): Promise<void>;
  async escribir(
    a: { alFallar?: () => Promise<void>; alTerminar?: () => Promise<void> } | (() => Promise<void>),
    b?: () => Promise<void>,
  ): Promise<void> {
    const opciones = typeof a === "function" ? {} : a;
    const accion = typeof a === "function" ? a : (b as () => Promise<void>);
    try {
      await accion();
      await opciones.alTerminar?.();
    } catch (e) {
      this.mostrarError(Errores.mensaje(e));
      try {
        await opciones.alFallar?.();
      } catch {
        // si tampoco se puede volver a pedir, se queda lo que había
      }
    }
  }
}

export const Servicios = new ServiciosImpl();
