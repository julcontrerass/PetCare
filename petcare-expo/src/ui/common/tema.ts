/**
 * Tema del kit: reexporta la paleta, las fuentes, el espaciado y los radios, y define las sombras.
 * Todo el kit (y las pantallas) importan desde acá.
 */
import { Platform, type ViewStyle } from "react-native";
import { Colores } from "../../theme/colores";

export { Colores } from "../../theme/colores";
export type { NombreColor } from "../../theme/colores";
export { Fuentes, Espaciado, Radios } from "../../theme/tipografia";

/** Niveles de elevación: 0 ninguna, 1 tarjetas (2dp), 2 (4dp), 3 barra inferior (8dp), 4 banner y menús (10dp). */
export type NivelSombra = 0 | 1 | 2 | 3 | 4;

const ELEVACION: Record<NivelSombra, number> = { 0: 0, 1: 2, 2: 4, 3: 8, 4: 10 };

/**
 * Elevación suave multiplataforma: `elevation` en Android, `shadow*` en iOS y `boxShadow` en la web
 * (sin las advertencias de `shadow*` de react-native-web).
 */
export function sombra(nivel: NivelSombra = 1): ViewStyle {
  const e = ELEVACION[nivel];
  if (e === 0) return {};
  if (Platform.OS === "web") {
    return { boxShadow: `0px ${e / 2}px ${e * 1.5}px rgba(11, 42, 74, ${0.06 + e * 0.008})` };
  }
  if (Platform.OS === "android") return { elevation: e };
  return {
    shadowColor: Colores.brandNavy,
    shadowOpacity: 0.06 + e * 0.008,
    shadowRadius: e * 1.2,
    shadowOffset: { width: 0, height: e / 2 },
  };
}
