/*
 * Migrado de ui/common/Contacto.kt. En Android cada atajo devolvía un `Intent`; acá devuelve una [Intencion]: la
 * dirección a abrir con `Linking.openURL` (`https://wa.me/...`, `tel:...`, `mailto:...`) o una acción propia (compartir
 * un texto), y [abrir] la ejecuta. Todo funciona también en la web.
 */
import * as Clipboard from "expo-clipboard";
import { Linking, Platform, Share } from "react-native";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import { Avisos } from "./Avisos";

/** Qué hay que abrir: una dirección (`https:`, `tel:`, `mailto:`) o una acción propia, como compartir un texto. */
export type Intencion = string | (() => Promise<void>);

/** Atajos para hablar con el dueño de un paciente desde la app. */

/**
 * Número en el formato de WhatsApp para Argentina: código de país, 9 de celular y el número sin 0 ni 15.
 * Devuelve null si no hay un número usable.
 */
export function numeroWhatsApp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 8) return null;
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.startsWith("54")) {
    // Ya trae el país: si falta el 9 de celular se agrega
    return digitos.charAt(2) === "9" ? digitos : "549" + digitos.slice(2);
  }
  digitos = digitos.replace(/^0+/, "");
  // "11 15 1234 5678" o "011 15 ...": el 15 de celular no va con el 9 del código de país
  const m = /^(\d{2,4})15(\d{6,8})$/.exec(digitos);
  if (m) digitos = m[1] + m[2];
  return "549" + digitos;
}

/** Abre WhatsApp con el mensaje armado; null si el número no sirve. */
export function whatsApp(telefono: string, mensaje: string): Intencion | null {
  const numero = numeroWhatsApp(telefono);
  if (numero === null) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Mensaje con el que el veterinario le pasa al dueño los datos para ingresar a la cuenta que le creó.
 * [veterinario] y [clinica] son los del que lo envía; [mascotas] son los nombres de lo que va a poder ver.
 */
export function mensajeDeAcceso(
  dueno: string, mascotas: string[], email: string, password: string, veterinario: string, clinica: string,
): string {
  const t = dueno.trim();
  const primerNombre = t.includes(" ") ? t.slice(0, t.indexOf(" ")) : t;
  const deQuien =
    (veterinario.trim() === "" ? "tu veterinario" : veterinario.trim()) +
    (clinica.trim() !== "" ? ` de ${clinica.trim()}` : "");
  const cuales =
    mascotas.length === 0
      ? "tus mascotas"
      : mascotas.length === 1
        ? mascotas[0]
        : mascotas.slice(0, -1).join(", ") + " y " + mascotas[mascotas.length - 1];
  return (
    `Hola ${primerNombre}, soy ${deQuien}. Te creé tu cuenta en la app PetCare para que veas desde tu casa ` +
    `la ficha de ${cuales}: historial, vacunas, recetas y turnos.\n\n` +
    "Para ingresar:\n" +
    `Correo: ${email}\n` +
    `Contraseña temporal: ${password}\n\n` +
    "Al entrar, la app te va a pedir que elijas tu propia contraseña."
  );
}

/**
 * Mensaje de saludo para escribirle al dueño de un paciente por WhatsApp desde la ficha ("Hola Ana, te escribo por
 * Rex."). [propietario] es el nombre completo o "Sin datos".
 */
export function mensajeDeSaludo(propietario: string, mascota: string): string {
  const t = propietario !== "Sin datos" ? propietario : null;
  const dueno = t === null ? null : t.includes(" ") ? t.slice(0, t.indexOf(" ")) : t;
  return (dueno !== null ? `Hola ${dueno}, ` : "Hola, ") + `te escribo por ${mascota}.`;
}

/**
 * Mensaje con el que el veterinario le recuerda al dueño una vacuna o desparasitación (la que se avisa desde
 * "Vacunas pendientes"). [propietario] es el nombre completo o "Sin datos"; [clinica] puede estar vacía; [tipo] es el
 * singular del tipo de registro ("vacuna"); [proximaDosis] es la fecha de la dosis que toca.
 */
export function mensajeDeRevision(
  propietario: string | null | undefined, clinica: string, mascota: string, tipo: string, titulo: string,
  proximaDosis: LocalDate | null, hoy: LocalDate,
): string {
  const lugar = clinica.trim() === "" ? "la veterinaria" : clinica;
  const nombre = propietario != null && propietario !== "Sin datos"
    ? (propietario.includes(" ") ? propietario.slice(0, propietario.indexOf(" ")) : propietario)
    : null;
  const saludo = nombre !== null ? `Hola ${nombre}` : "Hola";
  const fecha = proximaDosis ? Fechas.corta(proximaDosis) : "";
  const estado = proximaDosis && proximaDosis.isBefore(hoy) ? `venció el ${fecha}` : `le toca el ${fecha}`;
  return (
    `${saludo}, te escribo de ${lugar}. A ${mascota} la ${tipo} ${titulo} ${estado}. ` +
    "¿Querés que te saque un turno para aplicarla?"
  );
}

/** Escribir un correo (`mailto:`). */
export function correo(email: string): Intencion {
  return `mailto:${email}`;
}

/** Abre el selector de aplicaciones para mandar un texto (cuando no hay un número de WhatsApp usable). */
export function compartirTexto(texto: string): Intencion {
  return async () => {
    if (Platform.OS === "web") {
      const nav = (globalThis as unknown as { navigator?: { share?: (d: { title?: string; text?: string }) => Promise<void> } })
        .navigator;
      if (nav?.share) {
        await nav.share({ title: "Enviar datos de acceso", text: texto });
        return;
      }
      // Sin Web Share API (escritorio, http): se copia para que lo pegue donde quiera
      await Clipboard.setStringAsync(texto);
      Avisos.exito("Texto copiado al portapapeles");
      return;
    }
    await Share.share({ message: texto, title: "Enviar datos de acceso" });
  };
}

export function llamar(telefono: string): Intencion | null {
  const numero = telefono.replace(/[^\d+]/g, "");
  if (numero.length < 6) return null;
  return `tel:${numero}`;
}

/** Abre la [intencion]; si es null avisa [sinDatos] y si no hay una aplicación para abrirla avisa que no hay. */
export async function abrir(intencion: Intencion | null, sinDatos: string): Promise<void> {
  if (intencion === null) {
    Avisos.aviso(sinDatos);
    return;
  }
  try {
    if (typeof intencion === "function") await intencion();
    else await Linking.openURL(intencion);
  } catch {
    Avisos.aviso("No hay una aplicación disponible para esta acción");
  }
}

export const Contacto = {
  numeroWhatsApp,
  whatsApp,
  mensajeDeAcceso,
  mensajeDeSaludo,
  mensajeDeRevision,
  correo,
  compartirTexto,
  llamar,
  abrir,
};
