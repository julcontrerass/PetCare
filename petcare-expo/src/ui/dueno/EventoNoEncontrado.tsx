/** Se muestra si se abre `/dueno/evento/[id]` con un turno que ya no existe (se canceló o se recargó la página). */
import { EstadoVacio } from "../common/EstadoVacio";
import { PantallaBase } from "../common/PantallaBase";
import { useDatos } from "../common/useDatos";
import { NavDueno } from "./navegacionDueno";

export function EventoNoEncontrado() {
  useDatos();
  return (
    <PantallaBase titulo="Editar turno" alVolver={() => NavDueno.irACalendario()}>
      <EstadoVacio
        icono="calendario" titulo="No encontramos el turno" mensaje="Puede que ya se haya cancelado."
        textoBoton="Ir al calendario" alBoton={() => NavDueno.irACalendario()} estilo={{ marginTop: 24 }}
      />
    </PantallaBase>
  );
}
