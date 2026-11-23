import { router } from "expo-router";
import { Sesion } from "../../data/sesion";
import type { EventoMascota, Mascota } from "../../model/modelos";
import type { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { EstadoDueno, PanelNotificacionesDueno } from "./estadoDueno";

/**
 * Navegación del dueño: las mismas funciones que `DuenoActivity` ofrecía a sus pantallas (`host.irAHome()`,
 * `host.irADetalleMascota(m)`...). Cada una lleva a una ruta de `src/app/dueno/`.
 *
 * Rutas: `/dueno` (inicio), `/dueno/mascotas`, `/dueno/recordatorios`, `/dueno/calendario`, `/dueno/perfil`,
 * `/dueno/perfil-editar`, `/dueno/veterinarios`, `/dueno/solicitudes`, `/dueno/mascota-nueva`,
 * `/dueno/mascota/[id]`, `/dueno/evento-nuevo?fecha=AAAA-MM-DD&mascota=Nombre`, `/dueno/evento/[id]` (editar)
 * y `/dueno/carnet` (sin barra inferior).
 */
export const NavDueno = {
  irAHome() { router.navigate("/dueno"); },
  irAMascotas() { router.navigate("/dueno/mascotas"); },
  irANuevaMascota() { router.push("/dueno/mascota-nueva"); },
  irADetalleMascota(mascota: Mascota) {
    EstadoDueno.mascotaActual = mascota;
    router.push({ pathname: "/dueno/mascota/[id]", params: { id: mascota.id } });
  },
  irARecordatorios() { router.navigate("/dueno/recordatorios"); },
  irACalendario() { router.navigate("/dueno/calendario"); },
  /** Asistente para agendar un evento; [mascota] deja elegida la mascota del primer paso. */
  irANuevoEvento(fecha?: LocalDate | null, mascota?: string | null) {
    const params: Record<string, string> = {};
    if (fecha) params.fecha = fecha.toString();
    if (mascota) params.mascota = mascota;
    router.push({ pathname: "/dueno/evento-nuevo", params });
  },
  /** Edita un turno con el mismo asistente de horarios que al sacarlo. */
  irAEditarEvento(evento: EventoMascota) {
    router.push({ pathname: "/dueno/evento/[id]", params: { id: evento.id } });
  },
  irAPerfil() { router.navigate("/dueno/perfil"); },
  irAEditarPerfil() { router.push("/dueno/perfil-editar"); },
  irAVeterinarios() { router.navigate("/dueno/veterinarios"); },
  irASolicitudes() { router.navigate("/dueno/solicitudes"); },
  abrirCarnet() { router.push("/dueno/carnet"); },
  mostrarNotificaciones() { PanelNotificacionesDueno.mostrar(); },
  /** Cierra la sesión (con confirmación) y vuelve al ingreso. */
  cerrarSesion() {
    Avisos.confirmar({
      titulo: "¿Cerrar sesión?",
      mensaje: "Vas a tener que ingresar de nuevo con tu correo y tu contraseña.",
      textoAceptar: "Cerrar sesión",
      textoCancelar: "Cancelar",
      peligro: false,
      icono: "salir",
      alAceptar: () => {
        void Sesion.cerrarYVolver();
      },
    });
  },
};
