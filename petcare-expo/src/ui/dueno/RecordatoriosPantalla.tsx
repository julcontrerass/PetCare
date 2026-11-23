/*
 * Migrado de ui/dueno/RecordatoriosPantalla.kt (mostrar) + pantalla_recordatorios.xml: recordatorios (turnos próximos,
 * completados y los hechos a mano) a pantalla completa.
 */
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { LocalDate } from "../../util/tiempo";
import { PantallaBase } from "../common/PantallaBase";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { BotonAgregar } from "./ComponentesHome";
import { NavDueno } from "./navegacionDueno";
import { RecordatoriosContenido } from "./RecordatoriosContenido";

export default function RecordatoriosPantalla() {
  useSesionRequerida();
  useDatos();
  const cantidad = DuenoRepo.eventosOrdenados(true).length;
  return (
    <PantallaBase
      bordes={["top"]} scroll={false} titulo="Recordatorios" subtitulo={cantidad === 1 ? "1 próximo" : `${cantidad} próximos`}
      alVolver={() => NavDueno.irAHome()}
      derecha={<BotonAgregar etiqueta="Agendar turno" onPress={() => NavDueno.irANuevoEvento(LocalDate.now())} />}
    >
      <RecordatoriosContenido global mascota={null} />
    </PantallaBase>
  );
}
