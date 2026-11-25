/*
 * Migrado de ui/dueno/NuevaMascotaPantalla.kt + pantalla_nueva_mascota.xml: alta de una mascota nueva.
 * (El título de la barra en Android era el texto "+" de `agregar_mascota`; acá dice "Agregar mascota".)
 */
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { Mascota } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { SelectorFechaNacimiento } from "../common/ComponentesDueno";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { PantallaBase } from "../common/PantallaBase";
import { elegirImagen } from "../common/Selectores";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { iconoDeTipo } from "./ComponentesHome";
import { NavDueno } from "./navegacionDueno";

function OpcionTipo({ nombre, elegido, alTocar }: { nombre: string; elegido: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <View style={estilos.celda}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={nombre} accessibilityState={{ selected: elegido }} onPress={alTocar} {...foco.props}
        style={[estilos.tipo, elegido ? estilos.tipoElegido : null, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Icono nombre={iconoDeTipo(nombre)} tamano={26} color={elegido ? Colores.white : Colores.primaryTeal} />
        <Texto tamano={13.5} color={elegido ? Colores.white : Colores.black} style={{ marginTop: 6 }}>{nombre}</Texto>
      </Pressable>
    </View>
  );
}

export default function NuevaMascotaPantalla() {
  useSesionRequerida();
  useDatos();
  const [tipo, setTipo] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [nacimiento, setNacimiento] = useState<LocalDate | null>(null);
  const [nombre, setNombre] = useState("");
  const [raza, setRaza] = useState("");
  const [calendario, setCalendario] = useState(false);

  // Cada vez que se entra, el formulario empieza vacío
  useFocusEffect(useCallback(() => {
    setTipo(null); setFoto(null); setNacimiento(null); setNombre(""); setRaza(""); setCalendario(false);
  }, []));

  const elegirFoto = async () => {
    const uri = await elegirImagen();
    if (uri) setFoto(uri);
  };

  const guardar = () => {
    const n = nombre.trim();
    if (!n) { Avisos.mostrar("Ingresá el nombre de la mascota"); return; }
    if (tipo == null) { Avisos.mostrar("Seleccioná el tipo de mascota"); return; }
    DuenoRepo.agregarMascota(new Mascota(n, tipo, { raza: raza.trim(), nacimiento, fotoUri: foto }));
    Avisos.mostrar("Mascota agregada correctamente");
    NavDueno.irAMascotas();
  };

  return (
    <PantallaBase formulario
      bordes={["top"]} fondo={Colores.white} titulo="Agregar mascota" alVolver={() => NavDueno.irAMascotas()} margen={24}
      pie={<Boton titulo="Guardar" alto={48} onPress={guardar} />}
    >
      <View style={estilos.fotoZona}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto" onPress={elegirFoto} style={cursorTocable}>
          <ImagenRemota
            fotoUri={foto}
            estilo={estilos.foto}
            respaldo={<Icono nombre="camara" tamano={40} color={Colores.textGray} />}
          />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto" onPress={elegirFoto} style={[estilos.camara, cursorTocable]}>
          <Icono nombre="camara" tamano={18} color={Colores.black} />
        </Pressable>
      </View>

      <Texto tamano={14} negrita color={Colores.black} style={{ marginTop: 24 }}>Tipo de mascota</Texto>
      <View style={estilos.grilla}>
        {TiposMascota.TODOS.map((t) => <OpcionTipo key={t} nombre={t} elegido={t === tipo} alTocar={() => setTipo(t)} />)}
      </View>

      <Campo
        etiqueta="Nombre" placeholder="Ingresá el nombre de tu mascota" value={nombre} onChangeText={setNombre}
        autoCapitalize="words" estilo={{ marginTop: 20 }}
      />
      <Campo etiqueta="Raza" placeholder="Ej: Golden retriever" value={raza} onChangeText={setRaza} estilo={{ marginTop: 20 }} />

      <Texto variante="etiqueta" tamano={14} color={Colores.black} style={{ marginTop: 20, marginBottom: 6 }}>Fecha de nacimiento</Texto>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Fecha de nacimiento" onPress={() => setCalendario(true)}
        style={[estilos.fecha, cursorTocable]}
      >
        <Texto color={nacimiento ? Colores.black : Colores.textGray}>{nacimiento ? Fechas.corta(nacimiento) : "Ej: 10 feb 2021"}</Texto>
      </Pressable>

      <SelectorFechaNacimiento
        visible={calendario} inicial={nacimiento} alElegir={setNacimiento} alCerrar={() => setCalendario(false)}
      />
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  fotoZona: { alignSelf: "center", marginTop: 8 },
  foto: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colores.lightGray, borderWidth: 2, borderColor: Colores.primaryTeal },
  camara: { position: "absolute", right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", ...sombra(1) },
  grilla: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, marginHorizontal: -4 },
  celda: { width: "33.333%", padding: 4 },
  tipo: { alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderRadius: 8, backgroundColor: Colores.white, borderWidth: 1, borderColor: "#DDDDDD" },
  tipoElegido: { backgroundColor: Colores.primaryTeal, borderColor: Colores.primaryTeal },
  fecha: { minHeight: 54, justifyContent: "center", paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white },
});
