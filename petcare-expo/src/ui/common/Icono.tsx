import type { ComponentProps } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colores } from "./tema";

type NombreMCI = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * Íconos de la app: nombre semántico en español -> ícono de MaterialCommunityIcons equivalente al `ic_*` del Android.
 * Los `ic_*` de Android están anotados a la derecha.
 */
export const Iconos = {
  // Navegación y acciones
  inicio: "home", // ic_home
  volver: "arrow-left", // baseline_arrow_back_24
  adelante: "arrow-right", // ic_arrow_forward
  chevronIzquierda: "chevron-left", // ic_chevron_left
  chevronDerecha: "chevron-right", // ic_chevron_right
  chevronAbajo: "chevron-down",
  chevronArriba: "chevron-up",
  cerrar: "close",
  mas: "plus", // ic_plus
  menos: "minus",
  masOpciones: "dots-horizontal", // ic_more
  lista: "format-list-bulleted", // ic_list
  buscar: "magnify", // ic_search
  filtro: "filter-variant",
  refrescar: "refresh",
  editar: "pencil", // ic_pencil
  borrar: "trash-can-outline",
  compartir: "share-variant",
  copiar: "content-copy",
  descargar: "download",
  subir: "upload",
  enlace: "link-variant",
  salir: "logout", // ic_logout
  ajustes: "cog-outline",
  // Estados
  check: "check", // ic_check
  checkCirculo: "check-circle", // ic_check_circle
  cancelar: "close-circle", // ic_cancel
  advertencia: "alert", // ic_warning
  info: "information",
  estrella: "star",
  favorito: "heart", // ic_favorite
  // Personas y cuenta
  persona: "account", // ic_person
  perfil: "account-circle",
  personas: "account-group",
  veterinario: "doctor",
  admin: "shield-account",
  candado: "lock", // ic_lock
  llave: "key", // ic_key
  ojo: "eye", // ic_eye
  ojoOculto: "eye-off",
  // Contacto y lugares
  telefono: "phone", // ic_phone
  correo: "email-outline", // ic_mail
  whatsapp: "whatsapp",
  ubicacion: "map-marker", // ic_location
  sede: "hospital-building",
  mapa: "map-outline",
  // Tiempo
  reloj: "clock-outline", // ic_clock
  calendario: "calendar-month", // ic_calendar
  calendarioMas: "calendar-plus", // ic_calendar_plus
  turno: "calendar-clock",
  historial: "history", // ic_history
  // Archivos
  camara: "camera", // ic_camera
  camaraMas: "camera-plus",
  galeria: "image-multiple",
  archivo: "file-outline",
  documento: "file-document-outline", // ic_document
  pdf: "file-pdf-box",
  informe: "file-chart-outline",
  solicitud: "clipboard-text-outline",
  // Notificaciones
  notificacion: "bell-outline", // ic_notifications
  notificacionActiva: "bell-ring-outline",
  // Mascotas
  mascotas: "paw",
  perro: "dog", // ic_dog
  gato: "cat",
  ave: "bird",
  pez: "fish", // ic_tipo_pez
  reptil: "snake", // ic_tipo_reptil
  roedor: "rodent", // ic_tipo_roedor
  conejo: "rabbit",
  caballo: "horse",
  cerdo: "pig",
  // Salud
  vacuna: "needle", // ic_syringe
  receta: "prescription",
  medicamento: "pill",
  cirugia: "content-cut", // ic_cirugia
  botiquin: "medical-bag", // ic_medical_kit
  medico: "hospital-box", // ic_medical
  pulso: "heart-pulse", // ic_pulse
  actividad: "run", // ic_activity
  peso: "weight-kilogram", // ic_weight
  gota: "water", // ic_drop
  nutricion: "food-apple", // ic_nutrition
  ciencia: "flask", // ic_science
  chip: "chip", // ic_chip
  grafico: "chart-line",
  // Especialidades (ic_esp_*)
  espCardiologia: "heart-pulse",
  espDermato: "bandage",
  espDolor: "emoticon-sad-outline",
  espEndocrino: "water-percent",
  espExoticos: "turtle",
  espFelina: "cat",
  espFisioterapia: "arm-flex",
  espGastro: "stomach",
  espHemato: "blood-bag",
  espHomeopatia: "leaf",
  espNefro: "water-outline",
  espNeuro: "brain",
  espNutricion: "food-apple",
  espOftalmologia: "eye-outline",
  espOncologia: "ribbon",
  espParasito: "bug",
  espPulmones: "lungs",
  // Servicios (ic_srv_*)
  srvBano: "shower",
  srvDiente: "tooth",
  srvEstetoscopio: "stethoscope",
  srvTomografia: "radiology-box",
} as const satisfies Record<string, NombreMCI>;

/** Nombre semántico de un ícono (clave de [Iconos]). */
export type NombreIcono = keyof typeof Iconos;

export interface IconoProps {
  nombre: NombreIcono;
  /** Tamaño en dp; 24 por defecto. */
  tamano?: number;
  /** Color; brandNavy por defecto. */
  color?: string;
  /** Si no se da, el ícono es decorativo y los lectores de pantalla lo ignoran (contentDescription=@null). */
  accessibilityLabel?: string;
  estilo?: StyleProp<TextStyle>;
}

/** Ícono de la app. */
export function Icono({ nombre, tamano = 24, color = Colores.brandNavy, accessibilityLabel, estilo }: IconoProps) {
  return (
    <MaterialCommunityIcons
      name={Iconos[nombre]}
      size={tamano}
      color={color}
      style={estilo}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel != null}
      importantForAccessibility={accessibilityLabel != null ? "yes" : "no-hide-descendants"}
    />
  );
}
