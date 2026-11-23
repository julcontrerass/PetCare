/*
 * Parte de interfaz de data/repositorio/NotificacionesVet.kt (`mostrar`): abre el panel con las notificaciones del
 * servidor y las marca como leídas. La parte de datos (lista, borrar, marcar) está en
 * src/data/repositorio/notificacionesVet.ts.
 */
import { useEffect, useState } from "react";
import { NotificacionesVet } from "../../data/repositorio/notificacionesVet";
import type { NotificacionDto } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { tipoNotificacionDeClave } from "../../model/modelos";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { Avisos } from "./Avisos";
import { PanelAvisos, type ItemAviso } from "./PanelAvisos";

export interface NotificacionesVetPanelProps {
  visible: boolean;
  alCerrar: () => void;
  /** Se llama cuando cambia algo (se marcaron como leídas, se borró una o todas), por ejemplo para el punto de la campana. */
  alCambiar?: () => void;
}

/**
 * Panel de avisos del veterinario. Al abrirse pide los avisos al servidor, los muestra (los que no se leyeron
 * resaltados) y recién después los da por leídos.
 */
export function NotificacionesVetPanel({ visible, alCerrar, alCambiar }: NotificacionesVetPanelProps) {
  const [items, setItems] = useState<ItemAviso[] | null>(null);

  useEffect(() => {
    if (!visible) {
      setItems(null);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        await NotificacionesVet.cargar();
        if (cancelado) return;
        const avisos = NotificacionesVet.lista;
        const noLeidas = new Set(avisos.filter((n) => !n.leida).map((n) => n.id));
        setItems(
          avisos.map((n) => ({
            tipo: tipoNotificacionDeClave(n.tipo), titulo: n.titulo, mensaje: n.mensaje,
            creada: Fechas.instante(n.created_at), sinLeer: noLeidas.has(n.id), origen: n,
          })),
        );
        if (noLeidas.size > 0) {
          NotificacionesVet.marcarLeidas();
          Servicios.avisarCambio();
          alCambiar?.();
        }
      } catch (e) {
        if (cancelado) return;
        Avisos.error(Errores.mensaje(e));
        alCerrar();
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PanelAvisos
      visible={visible && items !== null}
      alCerrar={alCerrar}
      avisos={items ?? []}
      alBorrar={(item) => {
        NotificacionesVet.borrar((item.origen as NotificacionDto).id);
        Servicios.avisarCambio();
        alCambiar?.();
      }}
      alBorrarTodas={() => {
        NotificacionesVet.borrarTodas();
        Servicios.avisarCambio();
        alCambiar?.();
        Avisos.exito("Notificaciones borradas");
      }}
    />
  );
}
