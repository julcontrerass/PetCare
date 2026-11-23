/*
 * Parte de plataforma de ui/common/Documentos.kt: lo que en Android dibujaba el `PdfDocument` y compartía con un
 * `FileProvider`. Acá se arma el HTML de la hoja A4 con el mismo diseño y se convierte a PDF con `expo-print`; se
 * comparte con `expo-sharing`.
 *
 * Web: `Print.printToFileAsync` no genera un archivo y `Print.printAsync({ html })` imprime la página actual (no el
 * HTML dado). Por eso en la web el mismo HTML se abre en una ventana aparte (o en un iframe oculto si el navegador
 * bloquea la ventana) y se llama a su diálogo de impresión, desde donde se elige "Guardar como PDF". "Compartir" usa
 * `navigator.share` (con el texto del documento) si existe y si no abre ese mismo diálogo.
 */
import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { RegistroSalud } from "../../data/repositorio/saludRepo";
import type { Prescripcion } from "../../model/clinica";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import {
  nombreDeArchivo, planoDeCertificadoSalud, planoDeCertificadoVacunacion, planoDeReceta,
  type Bloque, type DatosPaciente, type Plano, type Profesional,
} from "./Documentos";

/** Un PDF ya armado. En el celular [uri] es el archivo (`file://`); en la web no hay archivo y [uri] es null. */
export interface ArchivoPdf {
  uri: string | null;
  /** Nombre del archivo: `receta-rex-2026-10-12.pdf`. */
  nombre: string;
  plano: Plano;
  /** La hoja en HTML (la misma que se convirtió a PDF). */
  html: string;
}

// Medidas de la hoja del Kotlin (puntos): A4 de 595 x 842 con margen de 44
const ANCHO = 595;
const ALTO = 842;
const MARGEN = 44;

const MIME_PDF = "application/pdf";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const noVacio = (s: string) => s.trim() !== "";

function bloqueEnHtml(b: Bloque): string {
  switch (b.tipo) {
    case "encabezado": {
      const p = b.profesional;
      const contacto = [p.direccion, p.telefono].filter(noVacio).join(" · ");
      return (
        `<div class="encabezado"><div class="titulo-clinica">${escapar(noVacio(p.clinica) ? p.clinica : "PetCare")}</div>` +
        `<p class="normal">${escapar(`${p.nombre} · Matrícula ${p.matricula}`)}</p>` +
        (noVacio(contacto) ? `<p class="gris">${escapar(contacto)}</p>` : "") +
        `</div><hr>`
      );
    }
    case "titulo":
      return `<h1>${escapar(b.texto)}</h1>`;
    case "subtitulo":
      return `<h2>${escapar(b.texto)}</h2>`;
    case "texto": {
      const clase = b.negrita ? "negrita" : b.gris ? "gris" : "normal";
      const sangria = b.sangria > 0 ? ` style="margin-left:${b.sangria}pt"` : "";
      return `<p class="${clase}"${sangria}>${escapar(b.texto)}</p>`;
    }
    case "paciente": {
      const p = b.datos;
      const datos = [p.especie, p.raza, p.sexo, p.edad, p.peso].filter(noVacio).join(" · ");
      return (
        `<div class="paciente"><p class="gris">${escapar(`Fecha: ${Fechas.larga(b.fecha)}`)}</p>` +
        `<h2>Paciente</h2>` +
        `<p class="negrita">${escapar(p.nombre)}</p>` +
        (noVacio(datos) ? `<p class="normal">${escapar(datos)}</p>` : "") +
        (noVacio(p.microchip) ? `<p class="gris">${escapar(`Microchip: ${p.microchip}`)}</p>` : "") +
        (noVacio(p.propietario) ? `<p class="normal">${escapar(`Propietario: ${p.propietario}`)}</p>` : "") +
        `</div><hr>`
      );
    }
    case "espacio":
      return `<div style="height:${b.puntos}pt"></div>`;
    case "firma": {
      const p = b.profesional;
      return (
        `<div class="firma"><div class="linea-firma"><div class="negrita">${escapar(p.nombre)}</div>` +
        `<div class="gris">${escapar(`Matrícula ${p.matricula}`)}</div></div>` +
        `<p class="gris emitido">Emitido con PetCare</p></div>`
      );
    }
  }
}

const ESTILOS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 11.5pt; color: rgb(30,41,59);
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  p { margin: 0; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  .normal { font-size: 11.5pt; color: rgb(30,41,59); }
  .gris { font-size: 10.5pt; color: rgb(100,116,139); }
  .negrita { font-size: 11.5pt; font-weight: bold; color: rgb(30,41,59); }
  h1 { font-size: 19pt; font-weight: bold; color: rgb(15,23,42); margin: 14pt 0 8pt; line-height: 1.3; }
  h2 { font-size: 13pt; font-weight: bold; color: rgb(13,148,136); margin: 6pt 0 4pt; line-height: 1.3; page-break-after: avoid; }
  .encabezado { margin-top: 20pt; }
  .titulo-clinica { font-size: 19pt; font-weight: bold; color: rgb(15,23,42); line-height: 1.3; margin-bottom: 2pt; }
  hr { border: 0; border-top: 1pt solid rgb(203,213,225); margin: 6pt 0 8pt; }
  .paciente { padding-bottom: 8pt; }
  .firma { margin-top: 46pt; page-break-inside: avoid; }
  .linea-firma { width: 220pt; margin-left: auto; border-top: 1pt solid rgb(203,213,225); padding-top: 4pt; font-size: 11.5pt; line-height: 1.45; }
  .linea-firma .gris { font-size: 10.5pt; }
  .emitido { margin-top: 12pt; }
`;

/**
 * La hoja en HTML con el mismo diseño del PDF de Android: encabezado de la clínica, datos del paciente, indicaciones
 * o vacunas, y la firma con la matrícula, en una hoja A4 con margen de 44 pt.
 */
export function htmlDePlano(plano: Plano): string {
  // En iOS el margen va por la opción `margins` de expo-print: el `@page` no se respeta
  const margenPagina = Platform.OS === "ios" ? 0 : MARGEN;
  return (
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapar(nombreDeArchivo(plano))}</title>` +
    `<style>@page { size: ${ANCHO}pt ${ALTO}pt; margin: ${margenPagina}pt; }${ESTILOS}</style></head>` +
    `<body>${plano.bloques.map(bloqueEnHtml).join("")}</body></html>`
  );
}

// ---------- Archivos ----------

/** Arma el PDF del [plano]. En la web no se genera ningún archivo (ver [imprimir]). */
export async function generarPdf(plano: Plano): Promise<ArchivoPdf> {
  const nombre = nombreDeArchivo(plano);
  const html = htmlDePlano(plano);
  if (Platform.OS === "web") return { uri: null, nombre, plano, html };

  const margenes = Platform.OS === "ios" ? { top: MARGEN, right: MARGEN, bottom: MARGEN, left: MARGEN } : undefined;
  const impreso = await Print.printToFileAsync({ html, width: ANCHO, height: ALTO, margins: margenes });
  // El nombre que genera expo-print es al azar: se pasa a la carpeta "documentos" con el nombre del Kotlin
  try {
    const carpeta = new Directory(Paths.cache, "documentos");
    if (!carpeta.exists) carpeta.create({ intermediates: true, idempotent: true });
    const destino = new File(carpeta, nombre);
    await new File(impreso.uri).move(destino, { overwrite: true });
    return { uri: destino.uri, nombre, plano, html };
  } catch {
    // si no se pudo renombrar, el PDF sigue siendo válido con el nombre original
    return { uri: impreso.uri, nombre, plano, html };
  }
}

export function receta(
  profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, medicamentos: Prescripcion[], indicaciones = "",
): Promise<ArchivoPdf> {
  return generarPdf(planoDeReceta(profesional, paciente, fecha, medicamentos, indicaciones));
}

export function certificadoVacunacion(
  profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, vacunas: RegistroSalud[],
): Promise<ArchivoPdf> {
  return generarPdf(planoDeCertificadoVacunacion(profesional, paciente, fecha, vacunas));
}

export function certificadoSalud(
  profesional: Profesional, paciente: DatosPaciente, fecha: LocalDate, observaciones = "",
): Promise<ArchivoPdf> {
  return generarPdf(planoDeCertificadoSalud(profesional, paciente, fecha, observaciones));
}

// ---------- Web: impresión y compartir ----------

interface VentanaMinima {
  document: { open(): void; write(contenido: string): void; close(): void };
  focus(): void;
  print(): void;
}

interface IframeMinimo {
  style: { cssText: string };
  srcdoc: string;
  contentWindow: { focus(): void; print(): void } | null;
  onload: (() => void) | null;
  remove(): void;
}

interface NavegadorMinimo {
  share?: (datos: { title?: string; text?: string; url?: string }) => Promise<void>;
}

interface EntornoWeb {
  open?: (url: string, destino: string) => VentanaMinima | null;
  document?: { createElement(tipo: "iframe"): IframeMinimo; body: { appendChild(nodo: IframeMinimo): void } };
  navigator?: NavegadorMinimo;
  setTimeout: (fn: () => void, ms: number) => unknown;
}

const entornoWeb = (): EntornoWeb => globalThis as unknown as EntornoWeb;

/**
 * Web: abre el diálogo de impresión del navegador con la hoja ("Guardar como PDF"). Devuelve false si el navegador
 * no deja abrir ni la ventana ni el iframe.
 */
function imprimirEnWeb(html: string): boolean {
  const w = entornoWeb();
  try {
    const ventana = w.open?.("", "_blank") ?? null;
    if (ventana) {
      ventana.document.open();
      ventana.document.write(html);
      ventana.document.close();
      ventana.focus();
      // Se espera a que la hoja se dibuje antes de imprimir
      w.setTimeout(() => ventana.print(), 300);
      return true;
    }
  } catch {
    // se prueba con el iframe
  }
  try {
    const doc = w.document;
    if (!doc) return false;
    const marco = doc.createElement("iframe");
    marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    marco.srcdoc = html;
    marco.onload = () => {
      marco.contentWindow?.focus();
      marco.contentWindow?.print();
      w.setTimeout(() => marco.remove(), 60000);
    };
    doc.body.appendChild(marco);
    return true;
  } catch {
    return false;
  }
}

/**
 * Abre el PDF para verlo o guardarlo: en la web, el diálogo de impresión; en el celular, el selector del sistema (no
 * hay un visor propio: desde ahí se abre con el visor de PDF instalado).
 */
export async function imprimir(archivo: ArchivoPdf, titulo = "Documento"): Promise<boolean> {
  if (Platform.OS === "web") return imprimirEnWeb(archivo.html);
  return compartir(archivo, titulo);
}

/**
 * Abre el selector del teléfono para mandar o guardar el PDF. En la web usa `navigator.share` si existe (con el texto
 * del documento: la Web Share API no comparte archivos locales) y si no abre el diálogo de impresión.
 * Devuelve true si se pudo abrir algo; nunca lanza (como el `runCatching` del Kotlin).
 */
export async function compartir(archivo: ArchivoPdf, titulo: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const nav = entornoWeb().navigator;
      if (nav?.share) {
        await nav.share({ title: titulo, text: archivo.plano.texto() });
        return true;
      }
      return imprimirEnWeb(archivo.html);
    }
    if (!archivo.uri || !(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(archivo.uri, { mimeType: MIME_PDF, UTI: "com.adobe.pdf", dialogTitle: titulo });
    return true;
  } catch {
    return false;
  }
}

/** Agrupa las funciones con la misma forma de uso que el `object Documentos` del Kotlin. */
export const DocumentosPdf = {
  htmlDePlano,
  generarPdf,
  receta,
  certificadoVacunacion,
  certificadoSalud,
  imprimir,
  compartir,
};
