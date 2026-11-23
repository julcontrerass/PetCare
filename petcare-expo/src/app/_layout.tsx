import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { iniciarApp } from "../data/iniciar";
import { Sesion } from "../data/sesion";
import { Avisos } from "../ui/common/Avisos";
import { RaizApp } from "../ui/common/RaizApp";

/**
 * Raíz de la app (de PetCareApp.kt): prepara los canales de notificación y conecta la sesión con la
 * interfaz (los avisos en pantalla y la vuelta al ingreso al cerrar sesión).
 */
export default function LayoutRaiz() {
  useEffect(() => {
    Sesion.alAvisar = (mensaje) => Avisos.mostrar(mensaje);
    Sesion.alVolverAlIngreso = () => router.replace("/auth");
    void iniciarApp();
  }, []);

  return (
    <RaizApp>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </RaizApp>
  );
}
