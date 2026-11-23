/*
 * Migrado de EditarPerfilPantalla (al final de ui/dueno/PerfilPantalla.kt) + pantalla_editar_perfil.xml.
 * Formulario para editar nombre, teléfono y dirección (el correo es el de la cuenta y no se cambia desde acá).
 */
import { useRef, useState } from "react";
import { View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { PantallaBase } from "../common/PantallaBase";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { NavDueno } from "./navegacionDueno";

export default function EditarPerfilPantalla() {
  useSesionRequerida();
  const perfil = DuenoRepo.perfil;
  const [nombre, setNombre] = useState(perfil.nombre);
  const [telefono, setTelefono] = useState(perfil.telefono);
  const [direccion, setDireccion] = useState(perfil.direccion);
  const refTelefono = useRef<import("react-native").TextInput>(null);
  const refDireccion = useRef<import("react-native").TextInput>(null);

  const guardar = () => {
    const nombreLimpio = nombre.trim();
    if (nombreLimpio === "") {
      Avisos.mostrar("Completá tu nombre");
      return;
    }
    DuenoRepo.guardarPerfil(nombreLimpio, telefono.trim(), direccion.trim());
    Avisos.mostrar("Perfil actualizado correctamente");
    NavDueno.irAPerfil();
  };

  return (
    <PantallaBase
      titulo="Editar perfil"
      subtitulo="Actualizá tus datos de contacto"
      alVolver={() => NavDueno.irAPerfil()}
      pie={<Boton titulo="Guardar cambios" onPress={guardar} />}
    >
      <View>
        <Campo
          etiqueta="Nombre completo" icono="persona" value={nombre} onChangeText={setNombre} autoCapitalize="words"
          textContentType="name" returnKeyType="next" onSubmitEditing={() => refTelefono.current?.focus()}
        />
        <Campo etiqueta="Correo electrónico" icono="correo" value={perfil.email} editable={false} keyboardType="email-address" estilo={{ marginTop: 14 }} />
        <Campo
          ref={refTelefono} etiqueta="Teléfono" icono="telefono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad"
          returnKeyType="next" onSubmitEditing={() => refDireccion.current?.focus()} estilo={{ marginTop: 14 }}
        />
        <Campo
          ref={refDireccion} etiqueta="Dirección" icono="ubicacion" value={direccion} onChangeText={setDireccion} autoCapitalize="sentences"
          returnKeyType="done" onSubmitEditing={guardar} estilo={{ marginTop: 14 }}
        />
      </View>
    </PantallaBase>
  );
}
