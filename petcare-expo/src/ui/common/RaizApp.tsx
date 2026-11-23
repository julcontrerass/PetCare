import { useEffect, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { Servicios } from "../../data/servicios";
import { Avisos } from "./Avisos";
import { AvisosHost } from "./AvisosHost";
import { Colores } from "./tema";

// Mantiene el splash hasta tener las fuentes. En la web no hay splash nativo: no se toca.
if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

/** Pone el fondo de la página en la web (así no se ve blanco alrededor de la columna central). */
function fondoDelDocumento(): void {
  const doc = (globalThis as unknown as { document?: { body?: { style: { backgroundColor: string; margin: string } }; documentElement?: { style: { backgroundColor: string } } } }).document;
  if (!doc?.body) return;
  doc.body.style.backgroundColor = Colores.loginBg;
  doc.body.style.margin = "0";
  if (doc.documentElement) doc.documentElement.style.backgroundColor = Colores.loginBg;
}

/**
 * Raíz de la app: carga Nunito, mantiene el splash hasta que estén y monta los proveedores (gestos, zona segura),
 * la barra de estado (oscura sobre fondo claro: la app fuerza modo claro) y `<AvisosHost />`.
 */
export function RaizApp({ children }: { children?: ReactNode }) {
  const [cargadas, errorFuentes] = useFonts({ Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  const listo = cargadas || !!errorFuentes;

  useEffect(() => {
    if (Platform.OS === "web") fondoDelDocumento();
    // Los errores de las escrituras en segundo plano se muestran como cartel
    Servicios.alMostrarError = (mensaje) => Avisos.error(mensaje);
    return () => {
      Servicios.alMostrarError = null;
    };
  }, []);

  useEffect(() => {
    if (listo && Platform.OS !== "web") SplashScreen.hideAsync().catch(() => {});
  }, [listo]);

  if (!listo) return null;
  return (
    <GestureHandlerRootView style={estilos.raiz}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={Colores.loginBg} />
        <View style={estilos.raiz}>
          {children}
          <AvisosHost />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colores.loginBg },
});
