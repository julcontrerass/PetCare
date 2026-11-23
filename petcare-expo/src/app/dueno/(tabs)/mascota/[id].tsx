import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { DuenoRepo } from "../../../../data/repositorio/duenoRepo";
import { DetalleMascotaPantalla } from "../../../../ui/dueno/DetalleMascotaPantalla";
import { EstadoDueno } from "../../../../ui/dueno/estadoDueno";
import { useDatos } from "../../../../ui/common/useDatos";

/** /dueno/mascota/[id]: busca la mascota, la deja en `EstadoDueno.mascotaActual` y muestra su ficha. */
export default function RutaMascota() {
  useDatos();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const mascota = DuenoRepo.mascotas.find((m) => m.id === id) ?? null;
  if (mascota) EstadoDueno.mascotaActual = mascota;
  useEffect(() => {
    if (!mascota) router.replace("/dueno/mascotas");
  }, [mascota]);
  return mascota ? <DetalleMascotaPantalla key={mascota.id} mascota={mascota} /> : null;
}
