import { useSyncExternalStore } from "react";

type Oyente = () => void;
const oyentes = new Set<Oyente>();

/** Estado del menú emergente "Más" de la barra inferior (el `menuAbierto` de `BarraInferior.kt`). */
export const MenuMas = {
  abierto: false,
  abrir() { this.fijar(true); },
  cerrar() { this.fijar(false); },
  alternar() { this.fijar(!this.abierto); },
  fijar(valor: boolean) {
    if (this.abierto === valor) return;
    this.abierto = valor;
    oyentes.forEach((o) => o());
  },
  suscribir(oyente: Oyente): () => void {
    oyentes.add(oyente);
    return () => { oyentes.delete(oyente); };
  },
};

/** Se redibuja cuando el menú se abre o se cierra. */
export function useMenuMasAbierto(): boolean {
  return useSyncExternalStore((o) => MenuMas.suscribir(o), () => MenuMas.abierto, () => MenuMas.abierto);
}

/** Pestaña de la barra que corresponde a una ruta; null en las rutas ocultas (como `resaltar(-1)`). */
export type PestanaDueno = "inicio" | "mascotas" | "recordatorios";

export function pestanaDeRuta(nombre: string | undefined): PestanaDueno | null {
  if (nombre === "index") return "inicio";
  if (nombre === "mascotas") return "mascotas";
  if (nombre === "recordatorios") return "recordatorios";
  return null;
}

/** Qué hace el botón "atrás" del sistema: cierra el menú, vuelve a Inicio o deja que el sistema actúe. */
export function accionAtras(enTabs: boolean, enInicio: boolean, menuAbierto: boolean): "cerrarMenu" | "irAInicio" | "sistema" {
  if (menuAbierto) return "cerrarMenu";
  if (enTabs && !enInicio) return "irAInicio";
  return "sistema";
}
