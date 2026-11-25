import { Stack, usePathname } from "expo-router";
import { MarcoConMenu } from "../../ui/common/MenuLateral";
import { MenuLateralRecepcion } from "../../ui/recepcion/BarraRecepcion";

/**
 * Modo recepción: una pila sin encabezado. `(tabs)` tiene la barra inferior; "turno-nuevo" se apila encima.
 * En escritorio el menú lateral queda a la izquierda de todas sus pantallas (como en src/app/vet/_layout.tsx).
 */
export default function LayoutRecepcion() {
  const ruta = usePathname();
  return (
    <MarcoConMenu menu={<MenuLateralRecepcion ruta={ruta} />}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="turno-nuevo" />
      </Stack>
    </MarcoConMenu>
  );
}
