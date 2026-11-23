/*
 * Migrado de ui/dueno/PrimerIngresoDialogo.kt + dialog_primer_ingreso.xml: primer ingreso de un dueño al que un
 * veterinario le creó la cuenta. La contraseña temporal la conoce el veterinario: tiene que elegir una propia y
 * aceptar los términos antes de seguir.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { Registro } from "../../data/registro";
import { Servicios } from "../../data/servicios";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { DialogoCentral } from "../common/DialogoCentral";
import { Icono } from "../common/Icono";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable } from "../common/Web";
import { NavDueno } from "./navegacionDueno";

export function PrimerIngresoDialogo({ visible, alCerrar }: { visible: boolean; alCerrar: () => void }) {
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [terminos, setTerminos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const nombre = DuenoRepo.perfil.primerNombre;

  const guardar = async () => {
    const error =
      nueva.length < 6 ? "La contraseña debe tener al menos 6 caracteres"
      : nueva !== repetida ? "Las contraseñas no coinciden"
      : !terminos ? "Tenés que aceptar los términos y condiciones"
      : null;
    if (error) {
      Avisos.mostrar(error);
      return;
    }
    setGuardando(true);
    try {
      await Servicios.fuente.definirPassword(nueva);
      await Servicios.fuente.completarPrimerIngreso(Registro.VERSION_TERMINOS);
      DuenoRepo.perfil.debeCambiarPassword = false;
      alCerrar();
      Avisos.mostrar("Listo, ya podés usar tu cuenta");
    } catch (e) {
      setGuardando(false);
      Avisos.error(Errores.mensaje(e));
    }
  };

  return (
    <DialogoCentral visible={visible} alCerrar={() => {}} cancelable={false}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">Elegí tu contraseña</Texto>
      <Texto tamano={14} style={estilos.texto}>
        {(nombre.trim() ? `Hola ${nombre}, ` : "Hola, ") +
          "tu veterinario te creó esta cuenta con una contraseña temporal. Elegí una propia para empezar a usarla."}
      </Texto>
      <Campo placeholder="Nueva contraseña" accessibilityLabel="Nueva contraseña" contrasena value={nueva} onChangeText={setNueva} estilo={estilos.campo} />
      <Campo
        placeholder="Repetí la contraseña" accessibilityLabel="Repetí la contraseña" contrasena value={repetida}
        onChangeText={setRepetida} onSubmitEditing={guardar} estilo={estilos.campo2}
      />
      <Pressable
        accessibilityRole="checkbox" accessibilityLabel="Acepto los términos y condiciones" accessibilityState={{ checked: terminos }}
        onPress={() => setTerminos((t) => !t)} style={[estilos.terminos, cursorTocable]}
      >
        <View style={[estilos.caja, terminos ? estilos.cajaMarcada : null]}>
          {terminos ? <Icono nombre="check" tamano={16} color={Colores.white} /> : null}
        </View>
        <Texto style={estilos.textoTerminos}>Acepto los términos y condiciones</Texto>
      </Pressable>
      <View style={estilos.botones}>
        <Boton titulo="Cerrar sesión" variante="texto" alto={46} estilo={{ flex: 1 }} onPress={() => { alCerrar(); NavDueno.cerrarSesion(); }} />
        <Boton titulo="Guardar" alto={46} cargando={guardando} estilo={{ flex: 1 }} onPress={guardar} />
      </View>
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  texto: { marginTop: 8 },
  campo: { marginTop: 14 },
  campo2: { marginTop: 10 },
  terminos: { flexDirection: "row", alignItems: "center", marginTop: 12, minHeight: 44 },
  caja: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colores.primaryTeal, alignItems: "center", justifyContent: "center" },
  cajaMarcada: { backgroundColor: Colores.primaryTeal },
  textoTerminos: { marginLeft: 10, flex: 1 },
  botones: { flexDirection: "row", marginTop: 12, gap: 8 },
});
