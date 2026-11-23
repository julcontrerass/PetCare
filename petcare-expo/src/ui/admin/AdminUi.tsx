/* Migrado de ui/admin/AdminUi.kt. */
import { Linking, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AdminRepo, type TipoActividad } from "../../data/repositorio/adminRepo";
import { Fechas } from "../../util/fechas";
import { LocalDate, type LocalDateTime } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { ImagenRemota } from "../common/ImagenRemota";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import type { NombreIcono } from "../common/Icono";

/** Aspecto de una etiqueta de estado (los bg_chip_* de Android). */
export type TonoEtiqueta = "neutro" | "neutroTeal" | "ok" | "aviso" | "peligro";

const TONOS: Record<TonoEtiqueta, { fondo: string; texto: string }> = {
  neutro: { fondo: "#EEF2F1", texto: Colores.textGray },
  neutroTeal: { fondo: "#EEF2F1", texto: Colores.tealDark },
  ok: { fondo: Colores.lightGreen, texto: Colores.successGreen },
  aviso: { fondo: Colores.lightOrange, texto: Colores.accentOrangeDark },
  peligro: { fondo: Colores.lightRed, texto: Colores.dangerRed },
};

export interface EstiloEstado {
  texto: string;
  tono: TonoEtiqueta;
}

/** Textos, colores e íconos que comparten las pantallas del administrador. */
export const AdminUi = {
  estiloVet(estado: string): EstiloEstado {
    switch (estado) {
      case AdminRepo.PENDIENTE: return { texto: "En revisión", tono: "aviso" };
      case AdminRepo.ACTIVO: return { texto: "Activo", tono: "ok" };
      case AdminRepo.RECHAZADO: return { texto: "Rechazado", tono: "peligro" };
      default: return { texto: "Suspendido", tono: "neutro" };
    }
  },

  estiloDueno(estado: string): EstiloEstado {
    return estado === AdminRepo.SUSPENDIDO ? { texto: "Suspendido", tono: "neutro" } : { texto: "Activo", tono: "ok" };
  },

  /** "Hoy · 09:30". */
  cuando(f: LocalDateTime): string {
    return `${Fechas.relativa(f.toLocalDate())} · ${f.horaTexto()}`;
  },

  /** "Hoy", "Ayer" o "Hace N días". */
  hace(fecha: LocalDate): string {
    const dias = LocalDate.now().toEpochDay() - fecha.toEpochDay();
    if (dias <= 0) return "Hoy";
    if (dias === 1) return "Ayer";
    return `Hace ${dias} días`;
  },

  /** Ícono y color del ícono según el tipo de actividad. */
  iconoActividad(tipo: TipoActividad): { icono: NombreIcono; color: string } {
    switch (tipo) {
      case "REGISTRO": return { icono: "persona", color: Colores.primaryTeal };
      case "APROBACION": return { icono: "checkCirculo", color: Colores.successGreen };
      case "RECHAZO": return { icono: "cancelar", color: Colores.dangerRed };
      case "SUSPENSION": return { icono: "candado", color: Colores.accentOrangeDark };
      case "REACTIVACION": return { icono: "check", color: Colores.successGreen };
      case "BAJA": return { icono: "cancelar", color: Colores.textGray };
    }
  },

  /** Vacío o solo espacios cuenta como que coincide con todo; si no, algún campo tiene que contener el texto. */
  textoContiene(q: string, ...campos: string[]): boolean {
    const buscado = q.trim().toLowerCase();
    return buscado === "" || campos.some((c) => c.toLowerCase().includes(buscado));
  },

  /** Abre el marcador del teléfono con el número (solo dígitos y "+"). */
  llamar(telefono: string): void {
    abrirExterno("tel:" + telefono.replace(/[^\d+]/g, ""));
  },

  /** Abre el correo con el destinatario puesto. */
  escribir(email: string): void {
    abrirExterno(`mailto:${email}`);
  },
};

/** `Linking.openURL` con el aviso de Android cuando no hay una aplicación que pueda abrirlo. */
function abrirExterno(url: string): void {
  Linking.openURL(url).catch(() => Avisos.mostrar("No hay una aplicación disponible para esta acción"));
}

export interface EtiquetaAdminProps {
  texto: string;
  tono: TonoEtiqueta;
  /** Relleno vertical (3 por defecto; el estado grande usa 4). */
  vertical?: number;
  horizontal?: number;
  estilo?: StyleProp<ViewStyle>;
}

/** Etiqueta de color (HomePetChip con su bg_chip_*: 10.5sp bold, esquinas de 10). */
export function EtiquetaAdmin({ texto, tono, vertical = 3, horizontal = 8, estilo }: EtiquetaAdminProps) {
  const t = TONOS[tono];
  return (
    <View style={[estilos.etiqueta, { backgroundColor: t.fondo, paddingVertical: vertical, paddingHorizontal: horizontal }, estilo]}>
      <Texto variante="etiqueta" tamano={10.5} color={t.texto}>{texto}</Texto>
    </View>
  );
}

export interface AvatarAdminProps {
  nombre: string;
  fotoPath: string | null;
  /** Lado en dp; 52 por defecto. */
  tamano?: number;
}

/** Muestra la foto si existe; si no, las iniciales del nombre (AdminUi.avatar). */
export function AvatarAdmin({ nombre, fotoPath, tamano = 52 }: AvatarAdminProps) {
  return (
    <ImagenRemota
      fotoPath={fotoPath}
      accessibilityLabel={`Foto de ${nombre}`}
      estilo={{ width: tamano, height: tamano, borderRadius: 16, backgroundColor: Colores.lightTeal }}
      respaldo={<Texto variante="titulo" tamano={18} color={Colores.tealDark}>{AdminRepo.iniciales(nombre)}</Texto>}
    />
  );
}

const estilos = StyleSheet.create({
  etiqueta: { alignSelf: "flex-start", borderRadius: 10 },
});
