/**
 * Ayudas para la web (react-native-web): detección de plataforma en el momento de usarse (así las pruebas pueden
 * simular `Platform.OS = "web"`), tecla Escape para los modales, foco visible y cursor de lo tocable.
 */
import { useEffect, useState } from "react";
import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { Colores } from "../../theme/colores";

/** Ancho máximo (en dp) de la columna central en pantallas anchas: la app es de formato teléfono. */
export const ANCHO_COLUMNA = 480;

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

/** Estado de foco para un `Pressable`: `{ enfocado, props }` donde props va esparcido en el Pressable. */
export function useFoco(): { enfocado: boolean; props: { onFocus: () => void; onBlur: () => void } } {
  const [enfocado, setEnfocado] = useState(false);
  return { enfocado, props: { onFocus: () => setEnfocado(true), onBlur: () => setEnfocado(false) } };
}

/** El campo de texto de la web dibuja su propio borde de foco: se quita el contorno del navegador. */
export const sinContorno: TextStyle = Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : {};
