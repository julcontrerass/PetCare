import { Stack, usePathname } from "expo-router";
import { MarcoConMenu } from "../../ui/common/MenuLateral";
import { MenuLateralDueno } from "../../ui/dueno/BarraInferior";

/**
 * App del dueño (de DuenoActivity): las secciones con barra inferior y el carnet de salud, que va aparte. En
 * escritorio el menú lateral queda a la izquierda de todas sus pantallas.
 */
export default function LayoutDueno() {
  const ruta = usePathname();
  return (
    <MarcoConMenu menu={<MenuLateralDueno ruta={ruta} />}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="carnet" />
      </Stack>
    </MarcoConMenu>
  );
}
