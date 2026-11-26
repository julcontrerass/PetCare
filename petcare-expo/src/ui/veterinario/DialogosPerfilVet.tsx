/*
 * Hojas y diálogos del perfil del veterinario (de PerfilVetSeccion.kt): selección múltiple (especialidades y
 * notificaciones), editar perfil, cambiar contraseña, animales que atiende (sheet_tipos_animales.xml) y duración de los
 * turnos (sheet_duraciones.xml + item_duracion.xml). Componentes propios de la carpeta del veterinario.
 */
import { CampoBuscador, coincide, SinResultados } from "../common/Buscador";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CatalogoMedico } from "../../data/catalogoMedico";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { Servicios } from "../../data/servicios";
import { TiposMascota } from "../../model/tiposMascota";
import { Errores } from "../../util/errores";
import { ChipRegistro, GrupoChips } from "../auth/ChipRegistro";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { DialogoCentral } from "../common/DialogoCentral";
import { HojaInferior } from "../common/HojaInferior";
import { Icono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

function Botones({ alGuardar, alCerrar, deshabilitado, cargando }: { alGuardar: () => void; alCerrar: () => void; deshabilitado?: boolean; cargando?: boolean }) {
  return (
    <View style={estilos.botones}>
      <Boton titulo="Cancelar" variante="texto" alto={44} estilo={{ flex: 1 }} onPress={alCerrar} />
      <Boton titulo="Guardar" alto={44} estilo={{ flex: 1 }} deshabilitado={deshabilitado} cargando={cargando} onPress={alGuardar} />
    </View>
  );
}

function FilaMarca({ texto, marcada, alCambiar }: { texto: string; marcada: boolean; alCambiar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="checkbox" accessibilityLabel={texto} accessibilityState={{ checked: marcada }} onPress={alCambiar}
      {...foco.props} style={[estilos.filaMarca, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.caja, marcada ? { backgroundColor: Colores.primaryTeal, borderColor: Colores.primaryTeal } : null]}>
        {marcada ? <Icono nombre="check" tamano={16} color={Colores.white} /> : null}
      </View>
      <Texto variante="cuerpo" style={{ flex: 1, marginLeft: 14 }}>{texto}</Texto>
    </Pressable>
  );
}

/**
 * AlertDialog con `setMultiChoiceItems`: devuelve los valores marcados al guardar. Con [buscador] (el texto de ayuda
 * del campo) suma arriba un buscador; lo ya marcado se conserva aunque quede fuera de lo filtrado.
 */
export function DialogoMultiple({ titulo, opciones, marcadas, alGuardar, alCerrar, buscador }: {
  titulo: string; opciones: string[]; marcadas: boolean[]; alGuardar: (marcadas: boolean[]) => void; alCerrar: () => void;
  buscador?: string;
}) {
  const [valores, setValores] = useState<boolean[]>([...marcadas]);
  const [buscado, setBuscado] = useState("");
  const visibles = opciones.map((o, i) => ({ o, i })).filter(({ o }) => !buscador || coincide(o, buscado));
  return (
    <DialogoCentral visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">{titulo}</Texto>
      {buscador ? <CampoBuscador valor={buscado} alCambiar={setBuscado} placeholder={buscador} estilo={{ marginTop: 10 }} /> : null}
      <ScrollView style={{ maxHeight: 380, marginTop: 8 }} keyboardShouldPersistTaps="handled">
        {visibles.map(({ o, i }) => (
          <FilaMarca key={o} texto={o} marcada={valores[i]} alCambiar={() => setValores((v) => v.map((x, j) => (j === i ? !x : x)))} />
        ))}
        {visibles.length === 0 ? <SinResultados /> : null}
      </ScrollView>
      <Botones alCerrar={alCerrar} alGuardar={() => { alGuardar(valores); alCerrar(); }} />
    </DialogoCentral>
  );
}

export function DialogoEditarPerfil({ alCerrar, alGuardado }: { alCerrar: () => void; alGuardado: () => void }) {
  const [nombre, setNombre] = useState(PerfilVetRepo.nombre);
  const [matricula, setMatricula] = useState(PerfilVetRepo.matricula);
  const [telefono, setTelefono] = useState(PerfilVetRepo.telefono);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorMatricula, setErrorMatricula] = useState<string | null>(null);
  const guardar = () => {
    let ok = true;
    if (nombre.trim() === "") { setErrorNombre("Requerido"); ok = false; }
    if (matricula.trim() === "") { setErrorMatricula("Requerido"); ok = false; }
    if (!ok) return;
    PerfilVetRepo.nombre = nombre.trim();
    PerfilVetRepo.matricula = matricula.trim();
    PerfilVetRepo.telefono = telefono.trim();
    PerfilVetRepo.guardarDatos();
    alGuardado();
    Avisos.mostrar("Perfil profesional actualizado");
    alCerrar();
  };
  return (
    <DialogoCentral visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">Editar perfil profesional</Texto>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
        <Campo placeholder="Nombre y Apellido" accessibilityLabel="Nombre y Apellido" value={nombre} error={errorNombre} estilo={estilos.campo}
          onChangeText={(t) => { setNombre(t); setErrorNombre(null); }} autoCapitalize="words" />
        <Campo placeholder="Matrícula" accessibilityLabel="Matrícula" value={matricula} error={errorMatricula} estilo={estilos.campo}
          onChangeText={(t) => { setMatricula(t); setErrorMatricula(null); }} />
        <Campo placeholder="Teléfono de Contacto" accessibilityLabel="Teléfono de Contacto" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" estilo={estilos.campo} />
        {/* El correo es el de la cuenta: no se cambia desde el perfil profesional */}
        <Campo placeholder="Correo Electrónico" accessibilityLabel="Correo Electrónico" value={PerfilVetRepo.email} editable={false} estilo={estilos.campo} />
      </ScrollView>
      <Botones alCerrar={alCerrar} alGuardar={guardar} />
    </DialogoCentral>
  );
}

export function DialogoCambiarPassword({ alCerrar }: { alCerrar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const guardar = async () => {
    if (cargando) return;
    const error =
      actual.length === 0 ? "Ingresá tu contraseña actual"
      : nueva.length < 6 ? "La nueva contraseña debe tener al menos 6 caracteres"
      : nueva !== confirmar ? "Las contraseñas no coinciden"
      : nueva === actual ? "La nueva contraseña debe ser distinta a la actual"
      : null;
    if (error != null) {
      Avisos.mostrar(error);
      return;
    }
    setCargando(true);
    try {
      await Servicios.fuente.cambiarPassword(PerfilVetRepo.email, actual, nueva);
      Avisos.mostrar("Contraseña actualizada");
      alCerrar();
    } catch (e) {
      setCargando(false);
      const mensaje = Errores.mensaje(e);
      Avisos.mostrar(mensaje.startsWith("Correo o contraseña") ? "La contraseña actual es incorrecta" : mensaje);
    }
  };
  return (
    <DialogoCentral visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">Cambiar contraseña</Texto>
      <Campo contrasena placeholder="Contraseña actual" accessibilityLabel="Contraseña actual" value={actual} onChangeText={setActual} estilo={estilos.campo} />
      <Campo contrasena placeholder="Nueva contraseña" accessibilityLabel="Nueva contraseña" value={nueva} onChangeText={setNueva} estilo={estilos.campo} />
      <Campo contrasena placeholder="Confirmar nueva contraseña" accessibilityLabel="Confirmar nueva contraseña" value={confirmar} onChangeText={setConfirmar}
        estilo={estilos.campo} onSubmitEditing={() => void guardar()} />
      <Botones alCerrar={alCerrar} alGuardar={() => void guardar()} deshabilitado={cargando} />
    </DialogoCentral>
  );
}

/** Qué tipos de mascota atiende: los dueños solo pueden sacar turno para esos. */
export function HojaTiposAnimales({ alCerrar, alGuardado }: { alCerrar: () => void; alGuardado: () => void }) {
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(PerfilVetRepo.tiposAnimales));
  const [error, setError] = useState(false);
  const alternar = (tipo: string, marcado: boolean) => {
    setElegidos((a) => {
      const n = new Set(a);
      if (marcado) n.add(tipo); else n.delete(tipo);
      return n;
    });
    if (marcado) setError(false);
  };
  const guardar = () => {
    if (elegidos.size === 0) { setError(true); return; }
    PerfilVetRepo.tiposAnimales.clear();
    for (const t of TiposMascota.TODOS.filter((x) => elegidos.has(x))) PerfilVetRepo.tiposAnimales.add(t);
    PerfilVetRepo.guardarTiposAnimales();
    alGuardado();
    alCerrar();
    Avisos.mostrar("Animales que atendés actualizados");
  };
  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={21} accessibilityRole="header">Animales que atendés</Texto>
      <Texto variante="subtitulo" tamano={13.5} style={{ marginTop: 4 }}>
        Los dueños solo pueden sacarte turno para los tipos de mascota que marques. Los turnos que ya tenés se mantienen.
      </Texto>
      <GrupoChips estilo={{ marginTop: 16 }} espacioVertical={4}>
        {TiposMascota.TODOS.map((t) => <ChipRegistro key={t} texto={TiposMascota.plural(t)} marcado={elegidos.has(t)} alCambiar={(m) => alternar(t, m)} />)}
      </GrupoChips>
      {error ? <Texto variante="chico" tamano={13} color={Colores.dangerRed} style={{ marginTop: 8 }}>Elegí al menos un tipo de animal</Texto> : null}
      <Boton titulo="Guardar" alto={50} estilo={{ marginTop: 20 }} onPress={guardar} />
      <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={alCerrar} />
    </HojaInferior>
  );
}

function BotonRedondo({ texto, etiqueta, onPress }: { texto: string; etiqueta: string; onPress: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress} {...foco.props}
      style={[estilos.redondo, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="cuerpo" tamano={20}>{texto}</Texto>
    </Pressable>
  );
}

function FilaDuracion({ servicio, minutos, alCambiar }: { servicio: string; minutos: number; alCambiar: (m: number) => void }) {
  const porDefecto = CatalogoMedico.duracionPorDefecto(servicio);
  return (
    <View style={estilos.filaDuracion}>
      <View style={{ flex: 1 }}>
        <Texto variante="cuerpo" tamano={15} negrita>{servicio}</Texto>
        <Texto variante="chico" tamano={12.5} style={{ marginTop: 2 }}>
          {minutos === porDefecto ? "Duración habitual" : `Habitual: ${CatalogoMedico.textoDuracion(porDefecto)}`}
        </Texto>
      </View>
      <BotonRedondo texto="−" etiqueta={`Menos tiempo para ${servicio}`} onPress={() => alCambiar(Math.max(CatalogoMedico.DURACION_MINIMA_MIN, minutos - CatalogoMedico.PASO_DURACION_MIN))} />
      <Texto variante="cuerpo" tamano={15} negrita centrado style={{ width: 76 }}>{CatalogoMedico.textoDuracion(minutos)}</Texto>
      <BotonRedondo texto="+" etiqueta={`Más tiempo para ${servicio}`} onPress={() => alCambiar(Math.min(CatalogoMedico.DURACION_MAXIMA_MIN, minutos + CatalogoMedico.PASO_DURACION_MIN))} />
    </View>
  );
}

/** La duración de cada práctica: define cuánto tiempo bloquea en la agenda cada turno. */
export function HojaDuraciones({ servicios, alCerrar, alGuardado }: { servicios: string[]; alCerrar: () => void; alGuardado: () => void }) {
  const [valores, setValores] = useState<Record<string, number>>(() => Object.fromEntries(servicios.map((s) => [s, PerfilVetRepo.duracionDe(s)])));
  const guardar = () => {
    for (const [servicio, minutos] of Object.entries(valores)) {
      if (minutos === CatalogoMedico.duracionPorDefecto(servicio)) delete PerfilVetRepo.duraciones[servicio];
      else PerfilVetRepo.duraciones[servicio] = minutos;
    }
    PerfilVetRepo.guardarDuraciones();
    alGuardado();
    alCerrar();
    Avisos.mostrar("Duración de los turnos actualizada");
  };
  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={21} accessibilityRole="header">Duración de los turnos</Texto>
      <Texto variante="subtitulo" tamano={13.5} style={{ marginTop: 4 }}>
        Cuánto tiempo reservás para cada práctica. Los dueños solo ven los horarios en los que entra el turno completo.
      </Texto>
      <View style={{ marginTop: 16 }}>
        {servicios.map((s) => <FilaDuracion key={s} servicio={s} minutos={valores[s]} alCambiar={(m) => setValores((v) => ({ ...v, [s]: m }))} />)}
      </View>
      <Boton titulo="Guardar" alto={50} estilo={{ marginTop: 8 }} onPress={guardar} />
      <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={alCerrar} />
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  botones: { flexDirection: "row", gap: 8, marginTop: 16 },
  campo: { marginTop: 12 },
  filaMarca: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingVertical: 6 },
  caja: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colores.textGray, alignItems: "center", justifyContent: "center" },
  filaDuracion: { flexDirection: "row", alignItems: "center", backgroundColor: Colores.white, borderRadius: 18, padding: 12, marginBottom: 10, ...sombra(1) },
  redondo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Colores.loginFieldStroke, alignItems: "center", justifyContent: "center" },
});
