/*
 * Migrado de AuthActivity.abrirEnlaceDeRecuperacion y mostrarNuevaPassword (pantalla_nueva_password.xml).
 * Ruta `/auth/recuperar`: llega desde el enlace del correo (`petcare://recuperar?code=...` en el teléfono,
 * `/auth/recuperar?code=...` en la web). Canjea el código, pide la contraseña nueva y entra directo a la cuenta.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { Servicios } from "../../data/servicios";
import { Sesion } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { Colores } from "../common/tema";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { PantallaBase } from "../common/PantallaBase";
import { Texto } from "../common/Texto";
import { useAtenderCuenta } from "./useAtenderCuenta";
import type { EntradaTexto } from "./tipos";

type ParametrosRuta = Record<string, string | string[] | undefined>;

/**
 * Según cómo responda Supabase, los datos del enlace llegan en la consulta o en el fragmento (`#...`); el fragmento
 * no entra en los parámetros de la ruta, así que se lee de la dirección.
 */
function fragmentoDelEnlace(): string {
  try {
    if (Platform.OS === "web") {
      const lugar = (globalThis as unknown as { location?: { hash?: string } }).location;
      return (lugar?.hash ?? "").replace(/^#/, "");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLinkingURL } = require("expo-linking") as typeof import("expo-linking");
    const url = getLinkingURL();
    const i = url ? url.indexOf("#") : -1;
    return url && i >= 0 ? url.slice(i + 1) : "";
  } catch {
    return "";
  }
}

/** Arma el enlace `petcare://recuperar?...` con todos los parámetros que llegaron, para `abrirEnlaceDeRecuperacion`. */
export function armarEnlaceDeRecuperacion(parametros: ParametrosRuta, fragmento = ""): string {
  const consulta = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor === undefined) continue;
    for (const v of Array.isArray(valor) ? valor : [valor]) consulta.append(clave, v);
  }
  const texto = consulta.toString();
  return `petcare://recuperar${texto ? `?${texto}` : ""}${fragmento ? `#${fragmento}` : ""}`;
}

/** Un código de recuperación se puede canjear una sola vez: si la pantalla se monta dos veces se reutiliza el pedido. */
const canjes = new Map<string, Promise<void>>();

function canjear(enlace: string): Promise<void> {
  let canje = canjes.get(enlace);
  if (!canje) {
    canje = Servicios.fuente.abrirEnlaceDeRecuperacion(enlace);
    canjes.set(enlace, canje);
    // Si falla se puede volver a intentar con el mismo enlace (por ejemplo, sin conexión)
    canje.catch(() => canjes.delete(enlace));
  }
  return canje;
}

/** Solo para pruebas. */
export function olvidarCanjes(): void {
  canjes.clear();
}

type Estado = "validando" | "nueva";

export default function NuevaPasswordPantalla() {
  const parametros = useLocalSearchParams() as ParametrosRuta;
  const { atender, hojaModo } = useAtenderCuenta();
  const [estado, setEstado] = useState<Estado>("validando");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errorNueva, setErrorNueva] = useState<string | null>(null);
  const [errorRepetida, setErrorRepetida] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const refRepetida = useRef<EntradaTexto>(null);

  const enlace = armarEnlaceDeRecuperacion(parametros, fragmentoDelEnlace());

  const mostrarLogin = () => router.replace({ pathname: "/auth", params: { vista: "login" } });

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        await canjear(enlace);
        if (vigente) setEstado("nueva");
      } catch (e) {
        if (!vigente) return;
        mostrarLogin();
        Avisos.error(Errores.mensaje(e), "No se pudo abrir el enlace");
      }
    })();
    return () => {
      vigente = false;
    };
    // El enlace llega una sola vez con la ruta
     
  }, [enlace]);

  const guardar = async () => {
    if (guardando) return;
    if (nueva.length < 6) {
      setErrorNueva("Usá al menos 6 caracteres");
      return;
    }
    if (nueva !== repetida) {
      setErrorRepetida("Las contraseñas no coinciden");
      return;
    }
    setGuardando(true);
    try {
      await Servicios.fuente.definirPassword(nueva);
      Avisos.mostrar("Contraseña actualizada");
      const resultado = await Sesion.restaurar();
      if (resultado) atender(resultado);
      else mostrarLogin();
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setGuardando(false);
    }
  };

  if (estado === "validando") {
    return (
      <PantallaBase formulario fondo={Colores.white} margen={24} scroll={false}>
        <View style={estilos.espera} accessibilityLiveRegion="polite">
          <ActivityIndicator color={Colores.primaryTeal} size="large" />
          <Texto variante="subtitulo" centrado style={{ marginTop: 16 }}>Validando el enlace...</Texto>
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase formulario fondo={Colores.white} margen={24}>
      <Texto variante="titulo" color={Colores.black} style={{ marginTop: 48 }} accessibilityRole="header">Elegí tu nueva contraseña</Texto>
      <Texto variante="subtitulo" style={{ marginTop: 8 }}>
        Confirmamos tu correo. Escribí la contraseña que vas a usar de ahora en más.
      </Texto>
      <Campo
        estilo={{ marginTop: 24 }} placeholder="Nueva contraseña" accessibilityLabel="Nueva contraseña" value={nueva}
        onChangeText={(t) => {
          setNueva(t);
          setErrorNueva(null);
        }}
        error={errorNueva} contrasena textContentType="newPassword" autoComplete="new-password"
        returnKeyType="next" onSubmitEditing={() => refRepetida.current?.focus()}
      />
      <Campo
        ref={refRepetida} estilo={{ marginTop: 12 }} placeholder="Repetí la contraseña" accessibilityLabel="Repetí la contraseña" value={repetida}
        onChangeText={(t) => {
          setRepetida(t);
          setErrorRepetida(null);
        }}
        error={errorRepetida} contrasena textContentType="newPassword" autoComplete="new-password"
        returnKeyType="go" onSubmitEditing={() => void guardar()}
      />
      <Boton titulo="Guardar y entrar" alto={56} estilo={{ marginTop: 24 }} cargando={guardando} onPress={() => void guardar()} />
      {hojaModo}
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  espera: { flex: 1, alignItems: "center", justifyContent: "center" },
});
