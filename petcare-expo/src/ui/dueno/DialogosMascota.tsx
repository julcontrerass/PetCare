/*
 * Migrado de DetalleMascotaPantalla.kt: los cuadros de la ficha de la mascota (editar información, cambiar estado,
 * dar de baja). En Android eran AlertDialog; acá son hojas y diálogos del kit. Los errores de validación se ven en el
 * propio formulario (en Android eran avisos, que acá quedarían detrás de la hoja).
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import {
  EstadosMascota, Mascota, SIN_DATOS, Sexos, sexoDeTexto, type EstadoMascota,
} from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { SelectorFechaNacimiento } from "../common/ComponentesDueno";
import { DialogoCentral } from "../common/DialogoCentral";
import { HojaInferior } from "../common/HojaInferior";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

function Opcion({ texto, detalle, elegida, alTocar }: { texto: string; detalle?: string; elegida: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="radio" accessibilityState={{ checked: elegida }} accessibilityLabel={texto} onPress={alTocar} {...foco.props}
      style={[estilos.opcion, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.radio, elegida ? estilos.radioElegido : null]}>
        {elegida ? <View style={estilos.radioPunto} /> : null}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Texto tamano={15} color={Colores.black}>{texto}</Texto>
        {detalle ? <Texto variante="chico">{detalle}</Texto> : null}
      </View>
    </Pressable>
  );
}

function Fichas<T extends string>({ opciones, valor, alElegir }: { opciones: readonly T[]; valor: T; alElegir: (v: T) => void }) {
  return (
    <View style={estilos.fichas}>
      {opciones.map((o) => {
        const elegido = o === valor;
        return (
          <Pressable
            key={o} accessibilityRole="button" accessibilityLabel={o} accessibilityState={{ selected: elegido }} onPress={() => alElegir(o)}
            style={[estilos.ficha, elegido ? estilos.fichaElegida : null, cursorTocable]}
          >
            <Texto tamano={13.5} color={elegido ? Colores.white : Colores.black}>{o}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const SIN_ESPECIFICAR = "Sin especificar";

/** "Editar Información de Mascota": mismos campos y validaciones que el Kotlin. */
export function EditarMascotaHoja({ mascota, alCerrar, alGuardar }: { mascota: Mascota; alCerrar: () => void; alGuardar: () => void }) {
  const m = mascota;
  const [nombre, setNombre] = useState(m.nombre);
  const [tipo, setTipo] = useState(TiposMascota.TODOS.find((t) => t.toLowerCase() === m.tipo.toLowerCase()) ?? TiposMascota.TODOS[0]);
  const [raza, setRaza] = useState(m.raza);
  const [nacimiento, setNacimiento] = useState<LocalDate | null>(m.nacimiento);
  const [sexo, setSexo] = useState<string>(m.sexo ?? SIN_ESPECIFICAR);
  const [peso, setPeso] = useState(m.peso);
  const [microchip, setMicrochip] = useState(m.microchip);
  const [color, setColor] = useState(m.color);
  const [observaciones, setObservaciones] = useState(m.observaciones);
  const [calendario, setCalendario] = useState(false);
  const [error, setError] = useState<{ campo: "nombre" | "microchip" | "peso"; texto: string } | null>(null);

  const guardar = () => {
    const n = nombre.trim();
    const chip = microchip.trim();
    const p = peso.trim();
    if (!n) return setError({ campo: "nombre", texto: "El nombre no puede quedar vacío" });
    if (chip && chip !== SIN_DATOS && !/^[0-9]{15}$/.test(chip)) return setError({ campo: "microchip", texto: "El microchip tiene 15 números" });
    if (p && p !== SIN_DATOS && !DuenoRepo.pesoValido(p)) return setError({ campo: "peso", texto: "Ingresá el peso en kilos, por ejemplo 12 o 3,5" });
    if (DuenoRepo.mascotas.some((o) => o !== m && o.nombre.toLowerCase() === n.toLowerCase())) {
      return setError({ campo: "nombre", texto: "Ya tenés una mascota con ese nombre" });
    }
    m.nombre = n;
    m.tipo = tipo;
    m.raza = raza.trim();
    m.nacimiento = nacimiento;
    m.sexo = sexoDeTexto(sexo);
    m.peso = p || SIN_DATOS;
    m.microchip = chip || SIN_DATOS;
    m.color = color.trim() || SIN_DATOS;
    m.observaciones = observaciones.trim() || "Sin observaciones";
    DuenoRepo.guardarMascota(m);
    alCerrar();
    alGuardar();
    Avisos.mostrar("Información actualizada");
  };
  const err = (c: string) => (error?.campo === c ? error.texto : null);

  return (
    <HojaInferior
      visible alCerrar={alCerrar}
      pie={
        <View style={estilos.botones}>
          <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ flex: 1 }} onPress={alCerrar} />
          <Boton titulo="Guardar" alto={50} estilo={{ flex: 1 }} onPress={guardar} />
        </View>
      }
    >
      <Texto tamano={20} negrita accessibilityRole="header">Editar Información de Mascota</Texto>
      <Campo etiqueta="Nombre" placeholder="Nombre" value={nombre} onChangeText={(t) => { setNombre(t); setError(null); }} error={err("nombre")} estilo={estilos.campo} />
      <Texto variante="etiqueta" style={estilos.rotulo}>Tipo</Texto>
      <Fichas opciones={TiposMascota.TODOS} valor={tipo} alElegir={setTipo} />
      <Campo etiqueta="Raza" placeholder="Raza" value={raza} onChangeText={setRaza} estilo={estilos.campo} />
      <Texto variante="etiqueta" style={estilos.rotulo}>Fecha de nacimiento</Texto>
      <Pressable accessibilityRole="button" accessibilityLabel="Fecha de nacimiento" onPress={() => setCalendario(true)} style={[estilos.fecha, cursorTocable]}>
        <Texto color={nacimiento ? Colores.black : Colores.textGray}>{nacimiento ? Fechas.corta(nacimiento) : "Fecha de nacimiento"}</Texto>
      </Pressable>
      <Texto variante="etiqueta" style={estilos.rotulo}>Sexo</Texto>
      <Fichas opciones={[SIN_ESPECIFICAR, ...Sexos]} valor={sexo} alElegir={setSexo} />
      <Campo etiqueta="Peso" placeholder="Peso" value={peso} onChangeText={(t) => { setPeso(t); setError(null); }} error={err("peso")} estilo={estilos.campo} />
      <Campo etiqueta="Microchip" placeholder="Microchip" value={microchip} onChangeText={(t) => { setMicrochip(t); setError(null); }} error={err("microchip")} keyboardType="number-pad" estilo={estilos.campo} />
      <Campo etiqueta="Color" placeholder="Color" value={color} onChangeText={setColor} estilo={estilos.campo} />
      <Campo etiqueta="Observaciones" placeholder="Observaciones" value={observaciones} onChangeText={setObservaciones} estilo={estilos.campo} />
      <SelectorFechaNacimiento visible={calendario} inicial={nacimiento} alElegir={setNacimiento} alCerrar={() => setCalendario(false)} />
    </HojaInferior>
  );
}

/** Activa, inactiva o fallecida: las dos últimas cancelan los turnos pendientes y conservan el historial. */
export function CambiarEstadoHoja({ mascota, alCerrar, alAplicar }: { mascota: Mascota; alCerrar: () => void; alAplicar: (m: Mascota, e: EstadoMascota) => void }) {
  const estados = Object.keys(EstadosMascota) as EstadoMascota[];
  const [elegido, setElegido] = useState<EstadoMascota>(mascota.estado);
  const guardar = () => {
    alCerrar();
    if (elegido === mascota.estado) return;
    if (elegido === "ACTIVA") {
      alAplicar(mascota, elegido);
      return;
    }
    Avisos.confirmar({
      titulo: `¿Pasar a ${EstadosMascota[elegido].etiqueta.toLowerCase()}?`,
      mensaje:
        `Se cancelan los turnos pendientes de ${mascota.nombre} y ya no se pueden sacar turnos nuevos. ` +
        'Su historial se conserva y lo ves en "Históricas".',
      textoAceptar: "Confirmar", textoCancelar: "Cancelar", peligro: false, icono: "perro",
      alAceptar: () => alAplicar(mascota, elegido),
    });
  };
  return (
    <HojaInferior
      visible alCerrar={alCerrar}
      pie={
        <View style={estilos.botones}>
          <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ flex: 1 }} onPress={alCerrar} />
          <Boton titulo="Guardar" alto={50} estilo={{ flex: 1 }} onPress={guardar} />
        </View>
      }
    >
      <Texto tamano={20} negrita accessibilityRole="header">{`Estado de ${mascota.nombre}`}</Texto>
      <View style={{ marginTop: 8 }}>
        {estados.map((e) => (
          <Opcion key={e} texto={EstadosMascota[e].etiqueta} detalle={EstadosMascota[e].descripcion} elegida={e === elegido} alTocar={() => setElegido(e)} />
        ))}
      </View>
    </HojaInferior>
  );
}

const MOTIVOS = ["Fallecimiento", "Adopción / Transferencia", "Otro motivo"];

/** Confirmación de la baja con el motivo (se guarda el texto de la opción elegida). */
export function BajaMascotaDialogo({ mascota, alCerrar, alConfirmar }: { mascota: Mascota; alCerrar: () => void; alConfirmar: (m: Mascota, motivo: string) => void }) {
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  return (
    <DialogoCentral visible alCerrar={alCerrar}>
      <Texto tamano={20} negrita accessibilityRole="header">{`Dar de baja a ${mascota.nombre}`}</Texto>
      <Texto variante="subtitulo" tamano={14} style={{ marginTop: 12 }}>
        ¿Estás seguro de que querés dar de baja a esta mascota? Ya no aparecerá en tu lista de mascotas activas.
      </Texto>
      <Texto tamano={14} negrita color={Colores.black} style={{ marginTop: 16 }}>Motivo de la baja:</Texto>
      <View style={{ marginTop: 8 }}>
        {MOTIVOS.map((m) => <Opcion key={m} texto={m} elegida={m === motivo} alTocar={() => setMotivo(m)} />)}
      </View>
      <View style={[estilos.botones, { marginTop: 12 }]}>
        <Boton titulo="Cancelar" variante="secundario" alto={46} estilo={{ flex: 1 }} onPress={alCerrar} />
        <Boton titulo="Confirmar baja" variante="peligro" alto={46} estilo={{ flex: 1 }} onPress={() => alConfirmar(mascota, motivo)} />
      </View>
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  campo: { marginTop: 14 },
  rotulo: { marginTop: 14, marginBottom: 6 },
  botones: { flexDirection: "row", gap: 12 },
  opcion: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingVertical: 6 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colores.textGray, alignItems: "center", justifyContent: "center" },
  radioElegido: { borderColor: Colores.primaryTeal },
  radioPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colores.primaryTeal },
  fichas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ficha: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colores.white, borderWidth: 1, borderColor: "#DDDDDD" },
  fichaElegida: { backgroundColor: Colores.primaryTeal, borderColor: Colores.primaryTeal },
  fecha: { minHeight: 54, justifyContent: "center", paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white },
});
