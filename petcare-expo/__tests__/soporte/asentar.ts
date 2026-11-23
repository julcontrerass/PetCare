/*
 * En Kotlin las escrituras (`Servicios.escribir`) corrían en el hilo principal y, con el servidor en memoria, terminaban
 * antes de que la prueba siguiera. En TypeScript son promesas sueltas: las pruebas llaman a `await asentar()` después
 * de una acción para dejar que terminen todas las escrituras pendientes.
 */
export async function asentar(vueltas = 5): Promise<void> {
  for (let i = 0; i < vueltas; i++) await new Promise<void>((r) => setImmediate(r));
}
