/*
 * Migrado de ui/veterinario/SeccionVet.kt. En Android cada sección era una clase con `layout`, `navId`, `configurar` y
 * `refrescar`; acá cada sección es una pantalla de una pestaña (ruta de `src/app/vet/(tabs)/`) y solo queda el
 * identificador de la solapa de la barra inferior (`R.id.nav_*`).
 */
export type SeccionVet = "inicio" | "pacientes" | "agenda" | "perfil";

/** Nombre de la ruta de cada pestaña dentro de `src/app/vet/(tabs)/`. */
export const RutaDeSeccion: Record<SeccionVet, string> = {
  inicio: "index",
  pacientes: "pacientes",
  agenda: "agenda",
  perfil: "perfil",
};

/** La solapa de una ruta, o null si no es una de las cuatro. */
export function seccionDeRuta(nombre: string): SeccionVet | null {
  const par = (Object.entries(RutaDeSeccion) as [SeccionVet, string][]).find(([, r]) => r === nombre);
  return par ? par[0] : null;
}
