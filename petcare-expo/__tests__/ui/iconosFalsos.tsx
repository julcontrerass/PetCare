import { Text } from "react-native";

/** Reemplazo de @expo/vector-icons en las pruebas (no hace falta cargar las fuentes de íconos). */
export function MaterialCommunityIcons({ name }: { name: string }) {
  return <Text>{`icono:${name}`}</Text>;
}
