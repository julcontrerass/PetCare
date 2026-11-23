/* Port de dialog_mascota_registro.xml y de mostrarDialogoMascota (RegistroDuenoActivity.kt). */
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { crearMascotaRegistro, type MascotaRegistro } from "../../data/datosRegistro";
import { TiposMascota } from "../../model/tiposMascota";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Colores } from "../common/tema";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { DialogoCentral } from "../common/DialogoCentral";
import { SelectorFecha } from "../common/SelectorFecha";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { ChipRegistro, GrupoChips } from "./ChipRegistro";
import { descartarFoto, elegirFoto } from "./elegirFoto";
import { FotoRedonda } from "./FotoRedonda";

const SEXOS = ["Macho", "Hembra"];

export interface MascotaRegistroDialogoProps {
  /** La mascota que se edita; null para una nueva. */
  existente: MascotaRegistro | null;
  alGuardar: (mascota: MascotaRegistro) => void;
  alCerrar: () => void;
}

/** El peso se guarda con su unidad ("12.5 kg"); al editar se vuelve a mostrar solo el número. */
function pesoSinUnidad(peso: string): string {
  return peso.replace(/\s*kg\s*$/i, "");
}

function CampoFecha({ valor, onPress }: { valor: string; onPress: () => void }) {
  const foco = useFoco();
  return (
    <View>
      <Texto variante="etiqueta" style={estilos.etiqueta}>Fecha de nacimiento (opcional)</Texto>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fecha de nacimiento (opcional)"
        onPress={onPress}
        {...foco.props}
        style={[estilos.fecha, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Texto variante="cuerpo" color={valor ? Colores.brandNavy : Colores.textGray}>{valor || "Elegir fecha"}</Texto>
      </Pressable>
    </View>
  );
}

export function MascotaRegistroDialogo({ existente, alGuardar, alCerrar }: MascotaRegistroDialogoProps) {
  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(existente?.tipo ?? null);
  const [sexo, setSexo] = useState<string | null>(existente?.sexo ?? null);
  const [raza, setRaza] = useState(existente?.raza ?? "");
  const [nacimiento, setNacimiento] = useState(existente?.nacimiento ?? "");
  const [peso, setPeso] = useState(pesoSinUnidad(existente?.peso ?? ""));
  const [color, setColor] = useState(existente?.color ?? "");
  const [microchip, setMicrochip] = useState(existente?.microchip ?? "");
  const [errorMicrochip, setErrorMicrochip] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState(existente?.observaciones ?? "");
  const [foto, setFoto] = useState<string | null>(existente?.fotoPath ?? null);
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const refNombre = useRef<TextInput>(null);
  const refMicrochip = useRef<TextInput>(null);

  const cambiarFoto = async () => {
    const path = await elegirFoto({ recortar: true });
    if (!path) return;
    if (foto != null && foto !== existente?.fotoPath) descartarFoto(foto);
    setFoto(path);
  };

  const cancelar = () => {
    if (foto != null && foto !== existente?.fotoPath) descartarFoto(foto);
    alCerrar();
  };

  const guardar = () => {
    const n = nombre.trim();
    if (n === "") {
      setErrorNombre("Ingresá el nombre");
      refNombre.current?.focus();
      return;
    }
    if (tipo == null) {
      Avisos.mostrar("Elegí qué tipo de mascota es");
      return;
    }
    if (sexo == null) {
      Avisos.mostrar("Elegí el sexo de la mascota");
      return;
    }
    const micro = microchip.trim();
    if (micro !== "" && micro.length !== 15) {
      setErrorMicrochip("El microchip tiene 15 dígitos");
      refMicrochip.current?.focus();
      return;
    }
    const p = peso.trim();
    alGuardar(
      crearMascotaRegistro({
        nombre: n, tipo, sexo, raza: raza.trim(), nacimiento, fotoPath: foto,
        peso: p === "" ? "" : `${p} kg`, color: color.trim(), microchip: micro, observaciones: observaciones.trim(),
      }),
    );
    alCerrar();
  };

  return (
    <DialogoCentral visible alCerrar={cancelar} relleno={0} anchoMaximo={460} estilo={estilos.caja}>
      <Texto variante="titulo" tamano={20} style={estilos.titulo} accessibilityRole="header">
        {existente ? "Editar mascota" : "Nueva mascota"}
      </Texto>
      <ScrollView style={estilos.scroll} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 12 }}>
          <FotoRedonda tamano={84} tamanoBoton={30} uri={foto} icono="perro" descripcion="Foto de la mascota" onPress={cambiarFoto} />
        </View>

        <Campo
          ref={refNombre}
          estilo={estilos.campo}
          etiqueta="Nombre"
          placeholder="Nombre de tu mascota"
          value={nombre}
          onChangeText={(t) => {
            setNombre(t);
            setErrorNombre(null);
          }}
          error={errorNombre}
          autoCapitalize="words"
        />

        <Texto variante="etiqueta" style={estilos.etiqueta}>Tipo de mascota</Texto>
        <GrupoChips>
          {TiposMascota.TODOS.map((t) => (
            <ChipRegistro key={t} texto={t} marcado={tipo === t} alCambiar={(m) => setTipo(m ? t : tipo === t ? null : tipo)} />
          ))}
        </GrupoChips>

        <Texto variante="etiqueta" style={estilos.etiqueta}>Sexo</Texto>
        <GrupoChips>
          {SEXOS.map((s) => (
            <ChipRegistro key={s} texto={s} marcado={sexo === s} alCambiar={(m) => setSexo(m ? s : sexo === s ? null : sexo)} />
          ))}
        </GrupoChips>

        <Campo estilo={estilos.campo} etiqueta="Raza (opcional)" placeholder="Ej: Golden Retriever" value={raza} onChangeText={setRaza} autoCapitalize="words" />

        <View style={estilos.campo}>
          <CampoFecha valor={nacimiento} onPress={() => setEligiendoFecha(true)} />
        </View>

        <Texto variante="etiqueta" tamano={15} style={estilos.masDatos}>Más datos (opcional)</Texto>
        <View style={estilos.fila}>
          <Campo
            estilo={estilos.mitad}
            etiqueta="Peso (kg)"
            placeholder="Ej: 12.5"
            value={peso}
            onChangeText={(t) => setPeso(t.replace(",", ".").replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
          />
          <Campo estilo={estilos.mitad} etiqueta="Color" placeholder="Ej: Dorado" value={color} onChangeText={setColor} autoCapitalize="sentences" />
        </View>

        <Campo
          ref={refMicrochip}
          estilo={estilos.campo}
          etiqueta="Microchip"
          placeholder="15 dígitos"
          value={microchip}
          onChangeText={(t) => {
            setMicrochip(t.replace(/[^0-9]/g, ""));
            setErrorMicrochip(null);
          }}
          error={errorMicrochip}
          keyboardType="number-pad"
        />

        <Campo
          estilo={estilos.campo}
          etiqueta="Observaciones"
          placeholder="Alergias, medicación, cuidados especiales..."
          value={observaciones}
          onChangeText={setObservaciones}
          multilinea
          autoCapitalize="sentences"
        />
      </ScrollView>
      <View style={estilos.botones}>
        <Boton titulo="Cancelar" variante="texto" alto={44} estilo={estilos.boton} onPress={cancelar} />
        <Boton titulo="Guardar mascota" variante="texto" alto={44} estilo={estilos.boton} onPress={guardar} />
      </View>

      <SelectorFecha
        visible={eligiendoFecha}
        valor={Fechas.parsear(nacimiento)}
        maxima={LocalDate.now()}
        titulo="Fecha de nacimiento"
        alElegir={(f) => {
          if (f.isAfter(LocalDate.now())) Avisos.mostrar("No podés elegir una fecha futura");
          else setNacimiento(Fechas.corta(f));
        }}
        alCerrar={() => setEligiendoFecha(false)}
      />
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  caja: { height: "86%", paddingTop: 20, paddingBottom: 8 },
  titulo: { marginHorizontal: 20 },
  scroll: { flex: 1, marginTop: 4 },
  contenido: { paddingHorizontal: 20, paddingBottom: 8 },
  campo: { marginTop: 14 },
  etiqueta: { marginTop: 14, marginBottom: 6 },
  masDatos: { marginTop: 20 },
  fila: { flexDirection: "row", gap: 12 },
  mitad: { flex: 1, marginTop: 14 },
  fecha: {
    minHeight: 50, justifyContent: "center", paddingHorizontal: 16, borderRadius: 16, borderWidth: 1,
    borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white,
  },
  botones: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 12, paddingTop: 4 },
  boton: { alignSelf: "auto", paddingHorizontal: 16 },
});
