/*
 * Migrado de ui/dueno/EstiloCategoria.kt: ícono y colores con los que se muestra cada categoría de evento.
 * Los íconos son nombres de `Iconos` del kit (`<Icono nombre={...} />`) y los colores son valores de `Colores`.
 */
import { CatalogoMedico } from "../../data/catalogoMedico";
import type { NombreIcono } from "./Icono";
import { Colores } from "./tema";

/** Ícono, color de fondo y color del ícono. */
export interface EstiloItem {
  icono: NombreIcono;
  fondo: string;
  color: string;
}

const esDelCatalogo = (categoria: string | null | undefined): categoria is string =>
  categoria != null && CatalogoMedico.TODAS.includes(categoria);

function iconoGenerico(categoria: string | null | undefined): NombreIcono {
  const c = categoria?.toLowerCase();
  if (c === undefined) return "calendario";
  if (c.includes("vacuna")) return "vacuna";
  if (c.includes("cirug") || c.includes("castraci")) return "cirugia";
  if (c.includes("chequeo") || c.includes("control")) return "botiquin";
  if (
    c.includes("estudio") || c.includes("tratamiento") || c.includes("laboratorio") || c.includes("tomograf") ||
    c.includes("cardio") || c.includes("neuro")
  ) return "pulso";
  if (c.includes("peluquer")) return "perro";
  return "calendario";
}

function fondoGenerico(categoria: string | null | undefined): string {
  const c = categoria?.toLowerCase();
  if (c === undefined) return Colores.iconTealBg;
  if (c.includes("vacuna")) return Colores.iconGreenBg;
  if (c.includes("control") || c.includes("consulta") || c.includes("chequeo")) return Colores.iconBlueBg;
  if (c.includes("cirug") || c.includes("castraci")) return Colores.iconPinkBg;
  if (c.includes("desparasit")) return Colores.iconOrangeBg;
  return Colores.iconPurpleBg;
}

function colorGenerico(categoria: string | null | undefined): string {
  const c = categoria?.toLowerCase();
  if (c === undefined) return Colores.primaryTeal;
  if (c.includes("vacuna")) return Colores.successGreen;
  if (c.includes("control") || c.includes("consulta") || c.includes("chequeo")) return Colores.primaryTeal;
  if (c.includes("cirug") || c.includes("castraci")) return Colores.dangerRed;
  if (c.includes("desparasit")) return Colores.accentOrange;
  return Colores.accentPurple;
}

const verde = { fondo: Colores.iconGreenBg, color: Colores.successGreen };
const azul = { fondo: Colores.iconBlueBg, color: Colores.primaryTeal };
const rojo = { fondo: Colores.iconPinkBg, color: Colores.dangerRed };
const violeta = { fondo: Colores.iconPurpleBg, color: Colores.accentPurple };
const naranja = { fondo: Colores.iconOrangeBg, color: Colores.accentOrange };
const teal = { fondo: Colores.iconTealBg, color: Colores.primaryTeal };

/** Ícono y colores con los que se presenta un servicio o una especialidad médica al elegirla. */
export function servicio(nombre: string): EstiloItem {
  const con = (base: { fondo: string; color: string }, icono: NombreIcono): EstiloItem => ({ icono, ...base });
  switch (nombre) {
    case "Chequeo médico integral": return con(azul, "srvEstetoscopio");
    case "Castraciones y limpieza dental": return con(rojo, "srvDiente");
    case "Cirugía 24hs": return con(rojo, "cirugia");
    case "Laboratorio y diagnóstico por imágenes": return con(violeta, "ciencia");
    case "Tomografía": return con(violeta, "srvTomografia");
    case "Baño y peluquería": return con(naranja, "srvBano");
    case "Oncología": return con(rojo, "espOncologia");
    case "Cardiología": return con(rojo, "espCardiologia");
    case "Fisioterapia": return con(teal, "espFisioterapia");
    case "Gastroenterología": return con(naranja, "espGastro");
    case "Nutrición": return con(verde, "espNutricion");
    case "Dermatología": return con(teal, "espDermato");
    case "Exóticos": return con(naranja, "espExoticos");
    case "Oftalmología": return con(azul, "espOftalmologia");
    case "Nefrourología": return con(azul, "espNefro");
    case "Endocrinología": return con(violeta, "espEndocrino");
    case "Neurología": return con(violeta, "espNeuro");
    case "Homeopatía": return con(verde, "espHomeopatia");
    case "Medicina felina": return con(teal, "espFelina");
    case "Hematología": return con(rojo, "espHemato");
    case "Parasitología": return con(naranja, "espParasito");
    case "Neumonología": return con(azul, "espPulmones");
    case "Medicina del dolor": return con(naranja, "espDolor");
    default: return { icono: iconoGenerico(nombre), fondo: fondoGenerico(nombre), color: colorGenerico(nombre) };
  }
}

/** Ícono de una categoría de evento ("Vacuna", "Cirugía", un servicio del catálogo...); el de calendario si no hay. */
export function icono(categoria: string | null | undefined): NombreIcono {
  if (esDelCatalogo(categoria)) return servicio(categoria).icono;
  return iconoGenerico(categoria);
}

/** Color de fondo del ícono. */
export function fondo(categoria: string | null | undefined): string {
  if (esDelCatalogo(categoria)) return servicio(categoria).fondo;
  return fondoGenerico(categoria);
}

/** Color del ícono. */
export function colorIcono(categoria: string | null | undefined): string {
  if (esDelCatalogo(categoria)) return servicio(categoria).color;
  return colorGenerico(categoria);
}

/** Estilo del encabezado de la ficha de un turno. */
export function turno(categoria: string): EstiloItem {
  const c = categoria.toLowerCase();
  if (c.includes("vacuna")) return { icono: "vacuna", fondo: Colores.lightTeal, color: Colores.primaryTeal };
  if (c.includes("control") || c.includes("chequeo")) return { icono: "pulso", fondo: Colores.lightTeal, color: Colores.primaryTeal };
  if (c.includes("cirug") || c.includes("castraci")) return { icono: "cirugia", fondo: Colores.lightOrange, color: Colores.accentOrange };
  return { icono: "actividad", fondo: Colores.lightPurple, color: Colores.accentPurple };
}

export const EstiloCategoria = { icono, fondo, colorIcono, servicio, turno };
