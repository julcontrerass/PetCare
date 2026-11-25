/*
 * `atender`, `elegirModo` y `entrarComo` de AuthActivity.kt: lleva al panel de la cuenta o, si no puede ingresar,
 * explica por qué. Lo comparten el ingreso y la pantalla de nueva contraseña.
 */
import { router } from "expo-router";
import { useCallback, useState, type ReactElement } from "react";
import { Sesion, type Resultado, type Rol } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { HojaLista } from "../common/HojaLista";

/** La ruta del panel de cada modo (las crean los grupos de dueño, veterinario y administrador). */
export function rutaDelRol(rol: Rol): "/dueno" | "/vet" | "/recepcion" | "/admin" {
  switch (rol) {
    case "DUENO": return "/dueno";
    case "VETERINARIO": return "/vet";
    case "RECEPCIONISTA": return "/recepcion";
    case "ADMIN": return "/admin";
  }
}

/** Cómo se presenta cada modo en "¿Cómo querés ingresar?". */
const OPCION_DE_MODO: Record<"DUENO" | "VETERINARIO" | "RECEPCIONISTA", { titulo: string; subtitulo: string; icono: "srvEstetoscopio" | "perro" | "calendario" }> = {
  DUENO: { titulo: "Como dueño de mascotas", subtitulo: "Tus mascotas, sus vacunas y sus turnos", icono: "perro" },
  VETERINARIO: { titulo: "Como veterinario", subtitulo: "Tu agenda, tus pacientes y tus turnos", icono: "srvEstetoscopio" },
  RECEPCIONISTA: { titulo: "En la recepción", subtitulo: "La agenda de los veterinarios para los que trabajás", icono: "calendario" },
};

export interface AtencionDeCuenta {
  /** Lleva al panel que corresponde, muestra el motivo del bloqueo o pregunta el modo de ingreso. */
  atender: (resultado: Resultado) => void;
  /** Hoja "¿Cómo querés ingresar?": se dibuja en la pantalla que usa el hook. */
  hojaModo: ReactElement | null;
}

export function useAtenderCuenta(): AtencionDeCuenta {
  const [roles, setRoles] = useState<Rol[] | null>(null);

  const atender = useCallback((resultado: Resultado) => {
    switch (resultado.tipo) {
      case "listo":
        router.replace(rutaDelRol(resultado.rol));
        break;
      case "bloqueada":
        Avisos.error(resultado.mensaje, "No podés ingresar");
        break;
      case "elegir":
        setRoles(resultado.roles);
        break;
    }
  }, []);

  /** Entra en el modo elegido: carga sus datos y va al panel. */
  const entrarComo = useCallback(
    async (rol: Rol) => {
      try {
        atender(await Sesion.entrarComo(rol));
      } catch (e) {
        Avisos.error(Errores.mensaje(e));
      }
    },
    [atender],
  );

  /** La cuenta es dueño y veterinario a la vez: se pregunta cómo quiere ingresar esta vez. */
  const hojaModo = roles ? (
    <HojaLista
      visible
      alCerrar={() => setRoles(null)}
      titulo="¿Cómo querés ingresar?"
      subtitulo="Tu cuenta se puede usar de más de una forma. Después podés cambiar de modo desde tu perfil."
      filas={roles.filter((rol) => rol !== "ADMIN").map((rol) => {
        const opcion = OPCION_DE_MODO[rol as keyof typeof OPCION_DE_MODO];
        return { ...opcion, alTocar: () => void entrarComo(rol) };
      })}
    />
  ) : null;

  return { atender, hojaModo };
}
