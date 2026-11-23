/* Controles que las pantallas de ingreso y de registro hacían con `Patterns.EMAIL_ADDRESS` y contando dígitos. */

/** `android.util.Patterns.EMAIL_ADDRESS`. */
const CORREO = /^[a-zA-Z0-9+._%-]{1,256}@[a-zA-Z0-9][a-zA-Z0-9-]{0,64}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,25})+$/;

export function esCorreoValido(correo: string): boolean {
  return CORREO.test(correo);
}

/** Cantidad de dígitos de un texto (un teléfono válido tiene al menos 8). */
export function contarDigitos(texto: string): number {
  return texto.replace(/[^0-9]/g, "").length;
}

/** Nombre y apellido: al menos 3 letras y un espacio entre palabras. */
export function esNombreYApellido(nombre: string): boolean {
  return !(nombre.length < 3 || !nombre.includes(" "));
}

/** Mantiene solo los números (los campos de DNI y microchip eran `inputType="number"`). */
export function soloNumeros(texto: string): string {
  return texto.replace(/[^0-9]/g, "");
}
