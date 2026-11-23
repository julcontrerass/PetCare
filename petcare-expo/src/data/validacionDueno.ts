/* Migrado de data/ValidacionDueno.kt */

const DNI = /^[0-9]{7,8}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Controles de los datos de un dueño que el veterinario carga en el consultorio. Devuelven el error o null. */
export const ValidacionDueno = {
  nombre(valor: string): string | null {
    return valor.trim().length < 2 ? "Ingresá el nombre y apellido del dueño" : null;
  },

  dni(valor: string): string | null {
    return !DNI.test(valor.trim()) ? "El DNI debe tener 7 u 8 números" : null;
  },

  telefono(valor: string): string | null {
    // Se cuentan los dígitos 0-9 (el Kotlin contaba cualquier dígito Unicode)
    const digitos = valor.replace(/[^0-9]/g, "").length;
    return digitos < 6 ? "Ingresá un teléfono válido" : null;
  },

  correo(valor: string): string | null {
    return !CORREO.test(valor.trim()) ? "Ingresá un correo válido" : null;
  },
};
