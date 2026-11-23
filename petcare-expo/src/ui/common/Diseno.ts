/**
 * Constantes de diseño (port de Diseno.kt y de `Responsive` de BaseActivity.kt).
 *
 * Diseno.forzar (forzar el cálculo de layout tras el ingreso) es un arreglo de Android y no existe en React Native.
 */

export const Diseno = {
  /** Alto mínimo de lo tocable (dp). */
  AREA_TACTIL: 44,
  /** Alto de los botones grandes. */
  ALTO_BOTON: 52,
  /** Alto de los campos de texto. */
  ALTO_CAMPO: 54,
  /** Ancho (dp) para el que se diseñaron las pantallas (Responsive.ANCHO_MINIMO_DP). */
  ANCHO_MINIMO: 360,
  /** Tope del tamaño de letra del sistema (Responsive.ESCALA_LETRA_MAXIMA): más rompe las pantallas. */
  ESCALA_LETRA_MAXIMA: 1.15,
  /** Margen horizontal habitual de las pantallas. */
  MARGEN_PANTALLA: 20,
  /** Duración de los avisos breves (ms). */
  DURACION_AVISO_MS: 3200,
} as const;
