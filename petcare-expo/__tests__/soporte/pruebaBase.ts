/*
 * Migrado de app/src/test/.../PruebaBase.kt. Cada prueba la usa así:
 *
 *   beforeEach(() => { fuente = prepararServicios(); });
 *   afterEach(() => limpiarServicios());
 *
 * Importar este archivo ANTES que los repositorios, porque deja simulados los módulos nativos (notificaciones y
 * almacenamiento) que usan los avisos.
 */
import type { PerfilDto } from "../../src/data/remoto/dtos";
import type { Resultado } from "../../src/data/sesion";
import { Servicios } from "../../src/data/servicios";
import { Sesion } from "../../src/data/sesion";
import { Escenario, FuenteEnMemoria } from "./fuenteEnMemoria";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationPriority: { HIGH: "high" },
  SchedulableTriggerInputTypes: { DATE: "date" },
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted", canAskAgain: true, expires: "never" })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted", canAskAgain: true, expires: "never" })),
  scheduleNotificationAsync: jest.fn(async (pedido: { identifier?: string }) => pedido.identifier ?? "id"),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
}));

/** El servidor en memoria de la prueba en curso (lo arma [prepararServicios]). */
let fuenteActual: FuenteEnMemoria | null = null;

export function fuente(): FuenteEnMemoria {
  if (!fuenteActual) throw new Error("Falta llamar a prepararServicios() en beforeEach");
  return fuenteActual;
}

/** Prepara la prueba con un servidor en memoria y sin ninguna sesión abierta. Devuelve esa fuente. */
export function prepararServicios(): FuenteEnMemoria {
  fuenteActual = new FuenteEnMemoria(Escenario.dueno());
  Servicios.fuentePrueba = fuenteActual;
  Sesion.olvidar();
  return fuenteActual;
}

export function limpiarServicios(): void {
  Servicios.fuentePrueba = null;
  Sesion.olvidar();
  fuenteActual = null;
  // Un aviso breve que quedó en pantalla deja un temporizador de 3 s que Jest avisa como abierto: se retira acá.
  // Se carga recién ahora para no arrastrar la interfaz a las pruebas de datos que no la usan.
  try {
     
    (require("../../src/ui/common/Avisos") as typeof import("../../src/ui/common/Avisos")).Avisos.retirarBanner();
  } catch {
    // sin interfaz cargada no hay nada que retirar
  }
}

/** Inicia sesión con [perfil] como cuenta y devuelve el resultado del ingreso. */
export async function ingresarComo(perfil: PerfilDto): Promise<Resultado> {
  fuente().yo = perfil;
  return Sesion.ingresar(perfil.email, "123456");
}

export function ingresarComoDueno(): Promise<Resultado> {
  return ingresarComo(Escenario.dueno());
}

export function ingresarComoVeterinario(): Promise<Resultado> {
  return ingresarComo(Escenario.veterinario());
}
