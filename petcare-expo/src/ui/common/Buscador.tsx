/*
 * Buscador de las listas para elegir (servicios, especialidades, tipos de evento): un campo con lupa que filtra sin
 * importar los acentos ni las mayúsculas ("cardio" encuentra "Cardiología", "cirugia" encuentra "Cirugía").
 */
import type { StyleProp, ViewStyle } from "react-native";
import { Campo } from "./Campo";
import { Texto } from "./Texto";

/** Texto sin acentos y en minúsculas, para comparar en los buscadores. */
export function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** [texto] contiene lo buscado (vacío: todo coincide). */
export function coincide(texto: string, buscado: string): boolean {
  const b = sinAcentos(buscado.trim());
  return b === "" || sinAcentos(texto).includes(b);
}

export function CampoBuscador({ valor, alCambiar, placeholder, estilo }: {
  valor: string; alCambiar: (t: string) => void; placeholder: string; estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <Campo
      estilo={estilo} icono="buscar" placeholder={placeholder} accessibilityLabel={placeholder} value={valor}
      onChangeText={alCambiar} returnKeyType="search" autoCorrect={false} autoCapitalize="none"
    />
  );
}

/** Lo que se ve cuando el buscador no encuentra nada. */
export function SinResultados({ texto = "No encontramos nada con ese nombre." }: { texto?: string }) {
  return <Texto variante="subtitulo" tamano={14} centrado style={{ paddingVertical: 20 }}>{texto}</Texto>;
}
