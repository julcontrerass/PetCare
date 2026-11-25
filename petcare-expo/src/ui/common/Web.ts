/**
 * Ayudas para la web (react-native-web): detección de plataforma en el momento de usarse (así las pruebas pueden
 * simular `Platform.OS = "web"`), tecla Escape para los modales, foco visible y cursor de lo tocable.
 */
import { useEffect, useState } from "react";
import { Platform, useWindowDimensions, type TextStyle, type ViewStyle } from "react-native";
import { Colores } from "../../theme/colores";

/** Ancho máximo (en dp) de la columna en formato teléfono (y de las hojas y avisos). */
export const ANCHO_COLUMNA = 480;

/** Desde este ancho (dp) la app usa el formato de escritorio: menú lateral y contenido ancho. */
export const ANCHO_ESCRITORIO = 900;

/** Ancho máximo del contenido en escritorio. */
export const ANCHO_CONTENIDO = 1100;

/** Ancho máximo de un formulario en escritorio: más ancho que el teléfono, sin estirar los campos de lado a lado. */
export const ANCHO_FORMULARIO = 720;

/** Ancho del menú lateral de escritorio. */
export const ANCHO_MENU_LATERAL = 260;

/** Separación entre columnas de una grilla (la misma del panel del administrador). */
export const SEPARACION_GRILLA = 12;

/** true si la ventana es lo bastante ancha para el formato de escritorio. En el teléfono siempre es false. */
export function useEscritorio(): boolean {
  const { width } = useWindowDimensions();
  return width >= ANCHO_ESCRITORIO;
}

export const esWeb = (): boolean => Platform.OS === "web";

interface EventoTecla {
  key: string;
}
interface DocumentoMinimo {
  addEventListener(tipo: "keydown", oyente: (e: EventoTecla) => void): void;
  removeEventListener(tipo: "keydown", oyente: (e: EventoTecla) => void): void;
}

/** Solo en la web: llama a [alEscape] cuando se aprieta Escape mientras [activo] sea true. En el celular no hace nada. */
export function useTeclaEscape(activo: boolean, alEscape: () => void): void {
  useEffect(() => {
    if (!esWeb() || !activo) return;
    const doc = (globalThis as unknown as { document?: DocumentoMinimo }).document;
    if (!doc) return;
    const oyente = (e: EventoTecla) => {
      if (e.key === "Escape") alEscape();
    };
    doc.addEventListener("keydown", oyente);
    return () => doc.removeEventListener("keydown", oyente);
  }, [activo, alEscape]);
}

/** Cursor de mano en lo tocable (solo tiene efecto en la web). */
export const cursorTocable: ViewStyle = Platform.OS === "web" ? { cursor: "pointer" } : {};

/** Anillo de foco visible (solo en la web) para lo que se maneja con el teclado. */
export function estiloFoco(enfocado: boolean): ViewStyle {
  if (!enfocado || !esWeb()) return {};
  return { outlineColor: Colores.primaryTeal, outlineWidth: 2, outlineStyle: "solid", outlineOffset: 2 };
}

interface DocumentoConPuntero {
  addEventListener(tipo: "keydown" | "mousedown" | "pointerdown" | "touchstart", oyente: () => void, captura?: boolean): void;
}

/**
 * Si la última interacción fue con el teclado (como `:focus-visible`): en la web un clic también enfoca el botón y
 * el anillo de foco quedaría marcado después de tocarlo con el mouse.
 */
let ultimaConTeclado = true;
let escuchandoInteraccion = false;

function escucharInteraccion(): void {
  if (escuchandoInteraccion || !esWeb()) return;
  const doc = (globalThis as unknown as { document?: DocumentoConPuntero }).document;
  if (!doc) return;
  escuchandoInteraccion = true;
  doc.addEventListener("keydown", () => { ultimaConTeclado = true; }, true);
  for (const tipo of ["mousedown", "pointerdown", "touchstart"] as const) {
    doc.addEventListener(tipo, () => { ultimaConTeclado = false; }, true);
  }
}

/**
 * Estado de foco para un `Pressable`: `{ enfocado, props }` donde props va esparcido en el Pressable. Solo marca el
 * foco cuando llega con el teclado (Tab); al tocar con el mouse no aparece el anillo.
 */
export function useFoco(): { enfocado: boolean; props: { onFocus: () => void; onBlur: () => void } } {
  const [enfocado, setEnfocado] = useState(false);
  useEffect(escucharInteraccion, []);
  return { enfocado, props: { onFocus: () => setEnfocado(ultimaConTeclado), onBlur: () => setEnfocado(false) } };
}

/** El campo de texto de la web dibuja su propio borde de foco: se quita el contorno del navegador. */
export const sinContorno: TextStyle = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : {};
