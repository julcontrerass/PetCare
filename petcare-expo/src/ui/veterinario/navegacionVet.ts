import { router } from "expo-router";
import { Sesion } from "../../data/sesion";
import { Avisos } from "../common/Avisos";

/**
 * Navegación del veterinario (de `HomeVeterinarioActivity` y de los `startActivity` de sus pantallas). Los
 * extras de los Intent de Android pasan a parámetros de ruta.
 *
 * Rutas (`src/app/vet/`): `/vet` (inicio), `/vet/agenda`, `/vet/pacientes`, `/vet/perfil` (pestañas con barra
 * inferior); y sin barra: `/vet/consulta-nueva?paciente=ID` (AgregarConsulta), `/vet/evento/[id]`
 * (DetalleEventoVet), `/vet/paciente/[id]?evento=TURNO_ID` (DetallePaciente: `evento` es el turno cuyo informe se
 * abre, lo que en Android era `EXTRA_EVENTO_ID`), `/vet/dueno-nuevo` (NuevoDueno), `/vet/solicitudes`
 * (SolicitudesVet) y `/vet/vacunas-pendientes`.
 */
export const NavVet = {
  irAInicio() { router.navigate("/vet"); },
  irAAgenda() { router.navigate("/vet/agenda"); },
  irAPacientes() { router.navigate("/vet/pacientes"); },
  irAPerfil() { router.navigate("/vet/perfil"); },
  /** AgregarConsultaActivity; [pacienteId] deja elegido el paciente (`EXTRA_PACIENTE_ID`). */
  agregarConsulta(pacienteId?: string | null) {
    router.push(pacienteId ? { pathname: "/vet/consulta-nueva", params: { paciente: pacienteId } } : "/vet/consulta-nueva");
  },
  detalleEvento(eventoId: string) {
    router.push({ pathname: "/vet/evento/[id]", params: { id: eventoId } });
  },
  /** DetallePacienteActivity; [eventoId] es el turno cuyo informe se abre. */
  detallePaciente(pacienteId: string, eventoId?: string | null) {
    router.push({ pathname: "/vet/paciente/[id]", params: eventoId ? { id: pacienteId, evento: eventoId } : { id: pacienteId } });
  },
  nuevoDueno() { router.push("/vet/dueno-nuevo"); },
  solicitudes() { router.push("/vet/solicitudes"); },
  vacunasPendientes() { router.push("/vet/vacunas-pendientes"); },
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
