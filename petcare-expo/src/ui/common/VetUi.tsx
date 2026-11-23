/*
 * Migrado de ui/common/VetUi.kt (ajustes de pantalla compartidos por las vistas del veterinario).
 *
 * `cargarFotoVet(imagen)` pasa a ser el componente `<FotoVet />`. `barras(...)` (íconos oscuros de la barra de estado y
 * relleno bajo las barras del sistema) no se porta: lo resuelven `StatusBar style="dark"` de RaizApp y SafeArea de
 * `PantallaBase`.
 */
import type { StyleProp, ViewStyle } from "react-native";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { Avatar } from "./Avatar";

export interface FotoVetProps {
  /** Diámetro en dp; 44 por defecto. */
  tamano?: number;
  estilo?: StyleProp<ViewStyle>;
}

/**
 * Muestra la foto del veterinario en sesión: la que subió (`fotoUri` si todavía se está subiendo o `fotoPath`) o, si no
 * hay, su inicial. Se vuelve a dibujar con la pantalla (`useDatos()`).
 */
export function FotoVet({ tamano, estilo }: FotoVetProps) {
  return (
    <Avatar nombre={PerfilVetRepo.nombre} fotoUri={PerfilVetRepo.fotoUri} fotoPath={PerfilVetRepo.fotoPath} tamano={tamano} estilo={estilo} />
  );
}

export const VetUi = { FotoVet };
