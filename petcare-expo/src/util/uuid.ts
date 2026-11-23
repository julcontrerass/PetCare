import * as Crypto from "expo-crypto";

/** Id nuevo para filas que crea la app (la base acepta el id que manda el cliente). */
export function nuevoId(): string {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === "string" && id !== "") return id;
  } catch {
    // sin módulo nativo (pruebas o un entorno sin crypto): se arma uno a mano
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
