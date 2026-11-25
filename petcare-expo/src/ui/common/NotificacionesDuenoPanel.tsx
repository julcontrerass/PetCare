/*
 * Migrado de ui/dueno/NotificacionesDialogo.kt: lista de notificaciones del dueño, en un panel que sube desde abajo.
 */
import { useEffect, useState } from "react";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { Servicios } from "../../data/servicios";
import type { NotificacionDueno } from "../../model/modelos";
import { Avisos } from "./Avisos";
import { PanelAvisos, type ItemAviso } from "./PanelAvisos";
import { destinoAvisoDueno, irADestinoDueno } from "../dueno/destinoAviso";

export interface NotificacionesDuenoPanelProps {
  visible: boolean;
  alCerrar: () => void;
  /** Se llama cuando cambia algo (se marcaron como leídas, se borró una o todas), por ejemplo para la insignia de la campana. */
  alCambiar?: () => void;
}

/**
 * Panel de avisos del dueño. Al abrirse toma la lista, marca en ella las que todavía no se vieron y recién después
 * las da por leídas.
 */
export function NotificacionesDuenoPanel({ visible, alCerrar, alCambiar }: NotificacionesDuenoPanelProps) {
  const [items, setItems] = useState<ItemAviso[] | null>(null);

  useEffect(() => {
    if (!visible) {
      setItems(null);
      return;
    }
    const lista = [...DuenoRepo.notificaciones];
    // Las que todavía no se vieron se marcan en la lista y recién después se dan por leídas
    const noLeidas = new Set(lista.filter((n) => !n.leida));
    DuenoRepo.marcarNotificacionesLeidas();
    Servicios.avisarCambio();
    alCambiar?.();
    setItems(
      lista.map((n) => ({
        tipo: n.tipo, titulo: n.titulo, mensaje: n.mensaje, creada: n.creada, sinLeer: noLeidas.has(n), origen: n,
      })),
    );
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PanelAvisos
      visible={visible && items !== null}
      alCerrar={alCerrar}
      avisos={items ?? []}
      alBorrar={(item) => {
        DuenoRepo.borrarNotificacion(item.origen as NotificacionDueno);
        Servicios.avisarCambio();
        alCambiar?.();
      }}
      alBorrarTodas={() => {
        DuenoRepo.limpiarNotificaciones();
        Servicios.avisarCambio();
        alCambiar?.();
        Avisos.mostrar("Notificaciones borradas");
      }}
      alAbrir={(item) => irADestinoDueno(destinoAvisoDueno(item, DuenoRepo.mascotas))}
    />
  );
}
