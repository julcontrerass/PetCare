/*
 * Hoja para cargar o editar otra veterinaria durante el registro (sheet_sede_vet.xml). Es el equivalente, dentro de
 * ui/auth, de EditorSede.kt, que la sección del veterinario porta aparte: acá no se depende de aquel.
 */
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View, type TextInput } from "react-native";
import { crearSede, textoHorarioSede, type SedeVet } from "../../model/modelos";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { Colores } from "../common/tema";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { HojaInferior } from "../common/HojaInferior";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { ChipRegistro, GrupoChips } from "./ChipRegistro";
import { SelectorHoraLibre } from "./SelectorHoraLibre";

/** Dirección y, debajo, los días y el horario; el texto que se muestra en las listas (`EditorSede.detalle`). */
export function detalleSede(sede: SedeVet): string {
  return [sede.direccion, textoHorarioSede(sede)].filter((s) => s.trim() !== "").join("\n");
}

function CampoHora({ etiqueta, valor, onPress }: { etiqueta: string; valor: string; onPress: () => void }) {
  const foco = useFoco();
  return (
    <View style={{ flex: 1 }}>
      <Texto variante="etiqueta" style={estilos.etiqueta}>{etiqueta}</Texto>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${valor} hs`}
        onPress={onPress}
        {...foco.props}
        style={[estilos.hora, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Texto variante="cuerpo">{`${valor} hs`}</Texto>
      </Pressable>
    </View>
  );
}

export interface EditorSedeRegistroProps {
  /** El lugar que se edita; null para uno nuevo. */
  sede: SedeVet | null;
  /** Recibe el lugar ya validado; la hoja se cierra sola después. */
  alGuardar: (sede: SedeVet) => void;
  /** Si se da, se ofrece "Eliminar este lugar" y quien llama decide qué hacer (la hoja se cierra después). */
  alEliminar?: () => void;
  alCerrar: () => void;
}

export function EditorSedeRegistro({ sede, alGuardar, alEliminar, alCerrar }: EditorSedeRegistroProps) {
  const [nombre, setNombre] = useState(sede?.nombre ?? "");
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [direccion, setDireccion] = useState(sede?.direccion ?? "");
  const [apertura, setApertura] = useState(sede?.apertura ?? "09:00");
  const [cierre, setCierre] = useState(sede?.cierre ?? "18:00");
  const [dias, setDias] = useState<number[]>(sede?.dias ?? [1, 2, 3, 4, 5]);
  const [eligiendo, setEligiendo] = useState<"apertura" | "cierre" | null>(null);
  const refNombre = useRef<TextInput>(null);

  /** Lo que se ve debajo de los horarios: cómo queda el lugar o, si falta algo, qué es. */
  const problema = (): string | null =>
    dias.length === 0 ? "Elegí al menos un día de atención." : cierre <= apertura ? "El horario de cierre tiene que ser posterior al de apertura." : null;

  const error = problema();
  const resumen = error ?? "Atiende " + textoHorarioSede(crearSede({ id: "", nombre: "", dias, apertura, cierre }));

  const alternarDia = (d: number, marcado: boolean) =>
    setDias((actuales) => (marcado ? [...new Set([...actuales, d])] : actuales.filter((x) => x !== d)));

  const guardar = () => {
    const nuevo = crearSede({
      id: sede?.id ?? "", nombre: nombre.trim(), direccion: direccion.trim(), dias: [...dias].sort((a, b) => a - b), apertura, cierre,
    });
    if (nuevo.nombre.trim() === "") {
      setErrorNombre("Ingresá el nombre de la veterinaria");
      refNombre.current?.focus();
      return;
    }
    if (problema() != null) return;
    alGuardar(nuevo);
    alCerrar();
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">{sede ? "Editar veterinaria" : "Agregar otra veterinaria"}</Texto>
      <Texto variante="subtitulo" tamano={13}>Cada lugar tiene su dirección, sus días y sus horarios.</Texto>

      <Campo
        ref={refNombre} estilo={estilos.campo} etiqueta="Nombre de la veterinaria" placeholder="Ej: Veterinaria Central" value={nombre}
        onChangeText={(t) => {
          setNombre(t);
          setErrorNombre(null);
        }}
        error={errorNombre} autoCapitalize="words"
      />
      <Campo estilo={estilos.campo} etiqueta="Dirección" placeholder="Calle, número y ciudad" value={direccion} onChangeText={setDireccion} autoCapitalize="words" />

      <Texto variante="etiqueta" style={estilos.etiqueta}>Días de atención</Texto>
      <GrupoChips espacioVertical={4}>
        {PerfilVetRepo.todosLosDias.map((dia, i) => (
          <ChipRegistro key={dia} texto={dia.slice(0, 3)} marcado={dias.includes(i + 1)} alCambiar={(m) => alternarDia(i + 1, m)} />
        ))}
      </GrupoChips>
      <View style={estilos.presets}>
        <Pressable accessibilityRole="button" onPress={() => setDias([1, 2, 3, 4, 5])} style={[estilos.preset, cursorTocable]}>
          <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>Lunes a viernes</Texto>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setDias([1, 2, 3, 4, 5, 6])} style={[estilos.preset, cursorTocable]}>
          <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>Lunes a sábado</Texto>
        </Pressable>
      </View>

      <View style={estilos.horas}>
        <CampoHora etiqueta="Desde" valor={apertura} onPress={() => setEligiendo("apertura")} />
        <CampoHora etiqueta="Hasta" valor={cierre} onPress={() => setEligiendo("cierre")} />
      </View>

      <Texto variante="cuerpo" tamano={13.5} color={error == null ? Colores.tealDark : Colores.dangerRed} style={estilos.resumen}>{resumen}</Texto>

      <Boton titulo="Guardar" alto={52} estilo={{ marginTop: 18 }} onPress={guardar} />
      <Boton titulo="Cancelar" variante="texto" estilo={{ marginTop: 4 }} onPress={alCerrar} />
      {alEliminar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eliminar este lugar"
          onPress={() => {
            alEliminar();
            alCerrar();
          }}
          style={[estilos.eliminar, cursorTocable]}
        >
          <Texto variante="boton" color={Colores.dangerRed}>Eliminar este lugar</Texto>
        </Pressable>
      ) : null}

      <SelectorHoraLibre
        visible={eligiendo != null}
        valor={eligiendo === "cierre" ? cierre : apertura}
        titulo={eligiendo === "cierre" ? "Hora de cierre" : "Hora de apertura"}
        alElegir={(h) => (eligiendo === "cierre" ? setCierre(h) : setApertura(h))}
        alCerrar={() => setEligiendo(null)}
      />
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  campo: { marginTop: 14 },
  etiqueta: { marginTop: 14, marginBottom: 6 },
  presets: { flexDirection: "row", marginTop: 4, gap: 10 },
  preset: { padding: 6, minHeight: 36, justifyContent: "center" },
  horas: { flexDirection: "row", gap: 12 },
  hora: {
    minHeight: 50, justifyContent: "center", paddingHorizontal: 16, borderRadius: 16, borderWidth: 1,
    borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white,
  },
  eliminar: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
  resumen: { marginTop: 16, backgroundColor: "#E3F3F1", borderRadius: 16, padding: 14 },
});
