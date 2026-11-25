/**
 * Se muestra si se abre `/dueno/evento/[id]` con un turno que ya no existe (se canceló o se recargó la página) o que ya
 * no se puede modificar (completado, cancelado o con la hora pasada).
 */
import { EstadoVacio } from "../common/EstadoVacio";
import { PantallaBase } from "../common/PantallaBase";
import { useDatos } from "../common/useDatos";
import { NavDueno } from "./navegacionDueno";

export function EventoNoEncontrado({ cerrado = false }: { cerrado?: boolean }) {
  useDatos();
  return (
    <PantallaBase titulo="Editar turno" alVolver={() => NavDueno.irACalendario()}>
      <EstadoVacio
        icono="calendario"
        titulo={cerrado ? "Este turno ya no se puede modificar" : "No encontramos el turno"}
        mensaje={cerrado ? "Ya pasó, se completó o se canceló. Si necesitás otro, sacá un turno nuevo." : "Puede que ya se haya cancelado."}
        textoBoton="Ir al calendario" alBoton={() => NavDueno.irACalendario()} estilo={{ marginTop: 24 }}
      />
    </PantallaBase>
  );
}
