import { router } from "expo-router";
import { EstadoVacio } from "../ui/common/EstadoVacio";
import { PantallaBase } from "../ui/common/PantallaBase";

/** Ruta que no existe (por ejemplo un enlace viejo en la web): vuelve al inicio. */
export default function NoEncontrada() {
  return (
    <PantallaBase scroll={false}>
      <EstadoVacio
        icono="advertencia"
        titulo="No encontramos esa página"
        mensaje="El enlace no existe o ya no está disponible."
        textoBoton="Ir al inicio"
        alBoton={() => router.replace("/")}
      />
    </PantallaBase>
  );
}
