/**
 * Todos los mensajes que ve el usuario (port de Avisos.kt): avisos breves que bajan desde arriba (confirmaciones y
 * datos que faltan) y carteles con botón para los errores y las confirmaciones de acciones delicadas.
 * Es un almacén simple: `<AvisosHost />` (montado una vez en la raíz) se suscribe y los dibuja. Nunca usa `Alert`.
 */
import { Diseno } from "./Diseno";
import type { NombreIcono } from "./Icono";

/** Aspecto del aviso breve: éxito (verde), aviso (naranja) o info (teal). */
export type TipoAviso = "exito" | "aviso" | "info";

export interface BannerAviso {
  id: number;
  mensaje: string;
  tipo: TipoAviso;
}

export interface CartelAviso {
  id: number;
  titulo: string;
  mensaje: string;
  icono: NombreIcono;
  peligro: boolean;
  textoAceptar: string;
  /** null si el cartel tiene un solo botón. */
  textoCancelar: string | null;
  cancelable: boolean;
  alAceptar: () => void;
}

export interface EstadoAvisos {
  banner: BannerAviso | null;
  /** Cola de carteles: se muestra el primero. */
  carteles: readonly CartelAviso[];
}

const palabrasDeExito = new RegExp(
  "actualizad|guardad|cancelad|creada|enviad|agregad|eliminad|subid|correctamente|completad|autorizad|" +
    "dado de alta|dada de alta|se sumó|borrad|reactivad|aceptad|marcad|restablecid|aprobad|registrad",
  "i",
);

type Oyente = () => void;

class AvisosImpl {
  private estadoActual: EstadoAvisos = { banner: null, carteles: [] };
  private oyentes = new Set<Oyente>();
  private contador = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  /** Duración del aviso breve en ms. */
  readonly DURACION_MS = Diseno.DURACION_AVISO_MS;

  /** Foto actual (inmutable: cambia de objeto con cada cambio; sirve para `useSyncExternalStore`). */
  get estado(): EstadoAvisos {
    return this.estadoActual;
  }

  suscribir = (oyente: Oyente): (() => void) => {
    this.oyentes.add(oyente);
    return () => {
      this.oyentes.delete(oyente);
    };
  };

  private cambiar(nuevo: EstadoAvisos): void {
    this.estadoActual = nuevo;
    for (const o of [...this.oyentes]) o();
  }

  // ---------- Avisos breves ----------

  /** Muestra el mensaje como confirmación o como advertencia según lo que dice (o con el [tipo] dado). */
  mostrar(mensaje: string, tipo?: TipoAviso): void {
    const t: TipoAviso = tipo ?? (palabrasDeExito.test(mensaje) ? "exito" : "aviso");
    this.retirarBanner();
    this.cambiar({ ...this.estadoActual, banner: { id: ++this.contador, mensaje, tipo: t } });
    this.temporizador = setTimeout(() => this.retirarBanner(), this.DURACION_MS);
  }

  exito(mensaje: string): void {
    this.mostrar(mensaje, "exito");
  }

  aviso(mensaje: string): void {
    this.mostrar(mensaje, "aviso");
  }

  /** Cierra el aviso breve (al tocarlo o al vencer el tiempo). */
  retirarBanner(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    if (this.estadoActual.banner) this.cambiar({ ...this.estadoActual, banner: null });
  }

  // ---------- Carteles ----------

  /** Cartel de error: explica qué pasó y se cierra con un botón. Sin [titulo], lo decide el mensaje. */
  error(mensaje: string, titulo?: string): void {
    const tituloFinal =
      titulo ?? (mensaje.includes("conexión") ? "Sin conexión" : mensaje.includes("permiso") ? "No tenés permiso" : "No se pudo completar");
    this.cartel({
      titulo: tituloFinal, mensaje, icono: "advertencia", peligro: true, textoAceptar: "Entendido",
      textoCancelar: null, cancelable: true, alAceptar: () => {},
    });
  }

  /** Cartel informativo con un solo botón (por ejemplo, "revisá tu correo"). */
  informar(o: { titulo: string; mensaje: string; icono?: NombreIcono; textoAceptar?: string; cancelable?: boolean; alAceptar?: () => void }): void {
    this.cartel({
      titulo: o.titulo, mensaje: o.mensaje, icono: o.icono ?? "checkCirculo", peligro: false,
      textoAceptar: o.textoAceptar ?? "Entendido", textoCancelar: null, cancelable: o.cancelable ?? true,
      alAceptar: o.alAceptar ?? (() => {}),
    });
  }

  /** Cartel de confirmación para una acción que no se puede deshacer o que conviene pensar dos veces. */
  confirmar(o: { titulo: string; mensaje: string; textoAceptar: string; textoCancelar?: string; peligro?: boolean; icono?: NombreIcono; alAceptar: () => void }): void {
    this.cartel({
      titulo: o.titulo, mensaje: o.mensaje, icono: o.icono ?? "cancelar", peligro: o.peligro ?? true,
      textoAceptar: o.textoAceptar, textoCancelar: o.textoCancelar ?? "Volver", cancelable: true, alAceptar: o.alAceptar,
    });
  }

  private cartel(c: Omit<CartelAviso, "id">): void {
    this.cambiar({ ...this.estadoActual, carteles: [...this.estadoActual.carteles, { ...c, id: ++this.contador }] });
  }

  /** Lo llama el host: saca el cartel de la cola (y si [aceptado], ejecuta su `alAceptar`). */
  cerrarCartel(id: number, aceptado: boolean): void {
    const cartel = this.estadoActual.carteles.find((c) => c.id === id);
    if (!cartel) return;
    this.cambiar({ ...this.estadoActual, carteles: this.estadoActual.carteles.filter((c) => c.id !== id) });
    if (aceptado) cartel.alAceptar();
  }

  /** Solo para pruebas: descarta todo. */
  reiniciar(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.cambiar({ banner: null, carteles: [] });
  }
}

export const Avisos = new AvisosImpl();
