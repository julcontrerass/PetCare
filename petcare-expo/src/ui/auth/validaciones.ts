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

/** CUIT o CUIL: 11 dígitos (con o sin guiones) y el dígito verificador correcto. */
export function esCuitValido(cuit: string): boolean {
  const c = cuit.replace(/\D/g, "");
  if (c.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(c[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(c[10]);
}

/** Qué está mal en un CUIT que no pasó [esCuitValido]. */
export function errorDeCuit(cuit: string): string {
  return cuit.replace(/\D/g, "").length !== 11
    ? "El CUIT tiene 11 números"
    : "Ese CUIT no es válido: revisá los números (el último es de control)";
}

/** Mantiene solo los números (los campos de DNI y microchip eran `inputType="number"`). */
export function soloNumeros(texto: string): string {
  return texto.replace(/[^0-9]/g, "");
}
