import type { ComponentRef } from "react";
import type { ScrollView, TextInput } from "react-native";

/** La instancia de un `TextInput` (para `ref` y `focus()`). */
export type EntradaTexto = ComponentRef<typeof TextInput>;
/** La instancia de un `ScrollView` (para `scrollTo`). */
export type Desplazable = ComponentRef<typeof ScrollView>;
