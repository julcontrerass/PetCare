/* Rutas del modo recepción (src/app/recepcion): las cuatro pestañas y el turno nuevo. */
import { router } from "expo-router";
import { Avisos } from "../common/Avisos";
import { Sesion } from "../../data/sesion";

export const NavRecepcion = {
  irAHoy() { router.navigate("/recepcion"); },
  irAAgenda() { router.navigate("/recepcion/agenda"); },
  irAPacientes() { router.navigate("/recepcion/pacientes"); },
  irAPerfil() { router.navigate("/recepcion/perfil"); },
  /** Turno nuevo; con [vetId] y [mascotaId] ya elegidos si se sabe para quién es. */
  nuevoTurno(vetId: string | null = null, mascotaId: string | null = null) {
    const params: Record<string, string> = {};
    if (vetId) params.vet = vetId;
    if (mascotaId) params.mascota = mascotaId;
    router.push({ pathname: "/recepcion/turno-nuevo", params });
  },
  cerrarSesion() {
    Avisos.confirmar({
      titulo: "¿Cerrar sesión?",
      mensaje: "Vas a tener que ingresar de nuevo con tu correo y tu contraseña.",
      textoAceptar: "Cerrar sesión",
      textoCancelar: "Cancelar",
      icono: "salir",
      alAceptar: () => void Sesion.cerrarYVolver(),
    });
  },
};
