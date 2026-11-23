import { useState, type Ref } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Colores, Fuentes } from "./tema";
import { Diseno } from "./Diseno";
import { Icono, type NombreIcono } from "./Icono";
import { Texto } from "./Texto";
import { cursorTocable, sinContorno } from "./Web";

export interface CampoProps extends Omit<TextInputProps, "multiline" | "secureTextEntry" | "style" | "ref"> {
  /** Etiqueta encima del campo (VetFormLabel). */
  etiqueta?: string;
  /** Mensaje de error: pone el borde en rojo y se muestra debajo. */
  error?: string | null;
  /** Texto de ayuda debajo (se oculta si hay error). */
  ayuda?: string;
  /** Ícono a la izquierda. */
  icono?: NombreIcono;
  multilinea?: boolean;
  /** Campo de contraseña con el ojito para mostrarla u ocultarla. */
  contrasena?: boolean;
  /** "pildora" (bg_login_field, radio 30) o "tarjeta" (bg_field_card, radio 16; por defecto). */
  forma?: "tarjeta" | "pildora";
  /** Contenedor completo (etiqueta + campo + mensajes). */
  estilo?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
}

/** Campo de texto con el mismo aspecto que bg_login_field / bg_field_card. Enter envía con `onSubmitEditing`. */
export function Campo({
  etiqueta, error, ayuda, icono, multilinea, contrasena, forma = "tarjeta", estilo, editable = true, ref, onFocus, onBlur, ...resto
}: CampoProps) {
  const [enfocado, setEnfocado] = useState(false);
  const [visible, setVisible] = useState(false);
  const borde = error ? Colores.dangerRed : enfocado ? Colores.primaryTeal : Colores.loginFieldStroke;
  return (
    <View style={estilo}>
      {etiqueta ? <Texto variante="etiqueta" style={estilos.etiqueta}>{etiqueta}</Texto> : null}
      <View
        style={[
          estilos.caja,
          { borderRadius: forma === "pildora" ? 30 : 16, borderColor: borde },
          multilinea ? estilos.cajaMultilinea : null,
          !editable ? estilos.apagado : null,
        ]}
      >
        {icono ? <Icono nombre={icono} tamano={24} color={Colores.textGray} estilo={multilinea ? estilos.iconoArriba : estilos.icono} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={Colores.textGray}
          accessibilityLabel={resto.accessibilityLabel ?? etiqueta ?? resto.placeholder}
          editable={editable}
          multiline={multilinea}
          textAlignVertical={multilinea ? "top" : "center"}
          secureTextEntry={contrasena && !visible}
          autoCapitalize={contrasena ? "none" : resto.autoCapitalize}
          autoCorrect={contrasena ? false : resto.autoCorrect}
          onFocus={(e) => {
            setEnfocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            onBlur?.(e);
          }}
          {...resto}
          style={[estilos.entrada, multilinea ? estilos.entradaMultilinea : null, sinContorno]}
        />
        {contrasena ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            onPress={() => setVisible((v) => !v)}
            hitSlop={6}
            style={[estilos.ojo, cursorTocable]}
          >
            <Icono nombre={visible ? "ojoOculto" : "ojo"} tamano={22} color={Colores.textGray} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Texto variante="chico" color={Colores.dangerRed} style={estilos.mensaje} accessibilityLiveRegion="polite">{error}</Texto>
      ) : ayuda ? (
        <Texto variante="chico" style={estilos.mensaje}>{ayuda}</Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { marginBottom: 6 },
  caja: {
    minHeight: Diseno.ALTO_CAMPO,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colores.white,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  cajaMultilinea: { alignItems: "flex-start", minHeight: 96, paddingVertical: 12 },
  apagado: { opacity: 0.6 },
  icono: { marginRight: 14 },
  iconoArriba: { marginRight: 14, marginTop: 2 },
  entrada: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fuentes.regular,
    fontSize: 16,
    color: Colores.black,
    paddingVertical: 0,
    height: Diseno.ALTO_CAMPO - 2,
  },
  entradaMultilinea: { height: undefined, minHeight: 72, paddingVertical: 0 },
  ojo: { width: Diseno.AREA_TACTIL, height: Diseno.AREA_TACTIL, alignItems: "center", justifyContent: "center", marginRight: -12 },
  mensaje: { marginTop: 4, marginLeft: 4 },
});
