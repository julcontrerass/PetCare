import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Guarda la sesión de Supabase. En el teléfono va al almacén cifrado (Keystore en Android, Keychain en iOS);
 * SecureStore limita cada valor a unos 2 KB y la sesión es más larga, así que se parte en pedazos. En la web
 * no existe un almacén cifrado: se usa el almacenamiento del navegador (localStorage), que es lo que usa Supabase.
 */
const TAMANO = 1800;
const opciones = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const clavePedazo = (clave: string, i: number) => `${clave}.${i}`;
const claveCantidad = (clave: string) => `${clave}.n`;

// SecureStore solo acepta letras, números, ".", "-" y "_" en las claves
const limpia = (clave: string) => clave.replace(/[^A-Za-z0-9._-]/g, "_");

const enWeb = Platform.OS === "web";

export const AlmacenSeguro = {
  async getItem(clave: string): Promise<string | null> {
    if (enWeb) return AsyncStorage.getItem(clave);
    const k = limpia(clave);
    const cantidad = Number((await SecureStore.getItemAsync(claveCantidad(k), opciones)) ?? "0");
    if (!cantidad) return null;
    let texto = "";
    for (let i = 0; i < cantidad; i++) {
      const pedazo = await SecureStore.getItemAsync(clavePedazo(k, i), opciones);
      if (pedazo == null) return null;
      texto += pedazo;
    }
    return texto;
  },

  async setItem(clave: string, valor: string): Promise<void> {
    if (enWeb) return AsyncStorage.setItem(clave, valor);
    const k = limpia(clave);
    await AlmacenSeguro.removeItem(clave);
    const pedazos = valor.match(new RegExp(`[\\s\\S]{1,${TAMANO}}`, "g")) ?? [];
    for (let i = 0; i < pedazos.length; i++) {
      await SecureStore.setItemAsync(clavePedazo(k, i), pedazos[i], opciones);
    }
    await SecureStore.setItemAsync(claveCantidad(k), String(pedazos.length), opciones);
  },

  async removeItem(clave: string): Promise<void> {
    if (enWeb) return AsyncStorage.removeItem(clave);
    const k = limpia(clave);
    const cantidad = Number((await SecureStore.getItemAsync(claveCantidad(k), opciones)) ?? "0");
    for (let i = 0; i < cantidad; i++) await SecureStore.deleteItemAsync(clavePedazo(k, i), opciones);
    await SecureStore.deleteItemAsync(claveCantidad(k), opciones);
  },
};
