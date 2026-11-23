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
export function rutaDelRol(rol: Rol): "/dueno" | "/vet" | "/admin" {
  switch (rol) {
    case "DUENO": return "/dueno";
    case "VETERINARIO": return "/vet";
    case "ADMIN": return "/admin";
  }
}

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
      subtitulo="Tu cuenta es de dueño y de veterinario. Después podés cambiar de modo desde tu perfil."
      filas={roles.map((rol) => {
        const veterinario = rol === "VETERINARIO";
        return {
          titulo: veterinario ? "Como veterinario" : "Como dueño de mascotas",
          subtitulo: veterinario ? "Tu agenda, tus pacientes y tus turnos" : "Tus mascotas, sus vacunas y sus turnos",
          icono: veterinario ? ("srvEstetoscopio" as const) : ("perro" as const),
          alTocar: () => void entrarComo(rol),
        };
      })}
    />
  ) : null;

  return { atender, hojaModo };
}
