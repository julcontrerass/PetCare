/*
 * Catálogo de servicios y especialidades, en el panel del administrador. Lo usan el registro y el perfil del
 * veterinario y el dueño al sacar un turno. El administrador agrega nuevos, cambia la duración por defecto (la que
 * usa el turno si el veterinario no puso otra) y desactiva los que no se ofrecen más. Las especialidades piden el
 * título aprobado. No se renombran: los veterinarios y los turnos guardan el nombre.
 */
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { CatalogoMedico, type ItemCatalogo } from "../../data/catalogoMedico";
import { CatalogoRepo } from "../../data/repositorio/catalogoRepo";
import { Errores } from "../../util/errores";
import { ChipRegistro, GrupoChips } from "../auth/ChipRegistro";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { coincide } from "../common/Buscador";
import { HojaInferior } from "../common/HojaInferior";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { EtiquetaAdmin } from "./AdminUi";
import { BuscadorAdmin, FiltrosAdmin } from "./FiltrosAdmin";

const DURACIONES = [15, 30, 45, 60, 90, 120, 180, 240];

const FILTROS: { estado: string | null; texto: string }[] = [
  { estado: "servicio", texto: "Servicios" },
  { estado: "especialidad", texto: "Especialidades" },
  { estado: "inactivo", texto: "Desactivados" },
  { estado: null, texto: "Todos" },
];

function cumple(i: ItemCatalogo, filtro: string | null): boolean {
  if (filtro === "inactivo") return !i.activo;
  return filtro == null || i.tipo === filtro;
}

function HojaServicio({ item, alCerrar }: { item: ItemCatalogo | null; alCerrar: () => void }) {
  const nuevo = item === null;
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [tipo, setTipo] = useState<ItemCatalogo["tipo"]>(item?.tipo ?? "servicio");
  const [duracion, setDuracion] = useState(item?.duracion_min ?? 30);
  const [activo, setActivo] = useState(item?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const repetido = nuevo && CatalogoMedico.ITEMS.some((i) => i.nombre.toLowerCase() === nombre.trim().toLowerCase());
  const problema = nombre.trim().length < 3 ? "Escribí el nombre" : repetido ? "Ya hay uno con ese nombre" : null;

  const guardar = async () => {
    if (problema) return;
    setGuardando(true);
    try {
      await CatalogoRepo.guardar({ nombre: nombre.trim(), tipo, duracion_min: duracion, activo });
      Avisos.mostrar(nuevo ? `Agregaste ${nombre.trim()}` : "Cambios guardados", "exito");
      alCerrar();
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setGuardando(false);
    }
  };

  return (
    <HojaInferior visible alCerrar={guardando ? () => {} : alCerrar}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">{nuevo ? "Agregar al catálogo" : item.nombre}</Texto>
      <Texto variante="subtitulo" tamano={13}>
        {nuevo
          ? "Lo van a poder elegir los veterinarios en su perfil y los dueños al sacar un turno."
          : "El nombre no se cambia: los veterinarios y los turnos lo guardan así."}
      </Texto>
      {nuevo ? (
        <>
          <Campo estilo={{ marginTop: 14 }} etiqueta="Nombre" placeholder="Ej: Odontología" value={nombre} onChangeText={setNombre} maxLength={60} autoCapitalize="sentences" />
          <Texto variante="etiqueta" style={estilos.etiqueta}>Tipo</Texto>
          <GrupoChips espacioVertical={4}>
            <ChipRegistro texto="Servicio" marcado={tipo === "servicio"} alCambiar={() => setTipo("servicio")} />
            <ChipRegistro texto="Especialidad (pide título)" marcado={tipo === "especialidad"} alCambiar={() => setTipo("especialidad")} />
          </GrupoChips>
        </>
      ) : null}
      <Texto variante="etiqueta" style={estilos.etiqueta}>Duración del turno por defecto</Texto>
      <GrupoChips espacioVertical={4}>
        {DURACIONES.map((d) => (
          <ChipRegistro key={d} texto={CatalogoMedico.textoDuracion(d)} marcado={duracion === d} alCambiar={() => setDuracion(d)} />
        ))}
      </GrupoChips>
      <Texto variante="chico" tamano={12.5} style={{ marginTop: 4 }}>Cada veterinario la puede cambiar para sus turnos.</Texto>
      {nuevo ? null : (
        <>
          <Texto variante="etiqueta" style={estilos.etiqueta}>Estado</Texto>
          <GrupoChips espacioVertical={4}>
            <ChipRegistro texto="Activo" marcado={activo} alCambiar={() => setActivo(true)} />
            <ChipRegistro texto="Desactivado" marcado={!activo} alCambiar={() => setActivo(false)} />
          </GrupoChips>
          {!activo ? (
            <Texto variante="chico" tamano={12.5} color={Colores.accentOrangeDark} style={{ marginTop: 4 }}>
              No se va a poder elegir ni sacar turnos para esto. Los turnos que ya están agendados siguen igual.
            </Texto>
          ) : null}
        </>
      )}
      {problema && nombre.trim() !== "" ? (
        <Texto variante="chico" tamano={13} color={Colores.dangerRed} style={{ marginTop: 10 }}>{problema}</Texto>
      ) : null}
      <Boton titulo={nuevo ? "Agregar" : "Guardar"} alto={50} estilo={{ marginTop: 18 }} cargando={guardando} deshabilitado={problema != null} onPress={() => void guardar()} />
      <Boton titulo="Cancelar" variante="texto" alto={46} estilo={{ marginTop: 4 }} deshabilitado={guardando} onPress={alCerrar} />
    </HojaInferior>
  );
}

function FilaServicio({ item, alAbrir }: { item: ItemCatalogo; alAbrir: () => void }) {
  const especialidad = item.tipo === "especialidad";
  return (
    <Tarjeta relleno={12} onPress={alAbrir} estilo={estilos.fila} accessibilityLabel={`${item.nombre}${item.activo ? "" : ", desactivado"}`}>
      <View style={estilos.filaContenido}>
        <View style={[estilos.icono, { backgroundColor: especialidad ? Colores.lightPurple : Colores.lightTeal }]}>
          <Icono nombre={especialidad ? "medico" : "botiquin"} tamano={20} color={especialidad ? Colores.accentPurple : Colores.primaryTeal} />
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Texto tamano={15} negrita numberOfLines={1} color={item.activo ? Colores.brandNavy : Colores.textGray}>{item.nombre}</Texto>
          <Texto variante="chico" tamano={12.5}>
            {`${especialidad ? "Especialidad · pide título" : "Servicio"} · ${CatalogoMedico.textoDuracion(item.duracion_min)}`}
          </Texto>
        </View>
        {item.activo ? null : <EtiquetaAdmin texto="Desactivado" tono="neutro" />}
        <Icono nombre="chevronDerecha" tamano={20} color={Colores.textGray} />
      </View>
    </Tarjeta>
  );
}

export function PanelServicios({ estiloPanel }: { estiloPanel: object }) {
  useDatos();
  const [filtro, setFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<ItemCatalogo | "nuevo" | null>(null);
  const items = CatalogoMedico.ITEMS;
  const lista = items.filter((i) => cumple(i, filtro) && coincide(i.nombre, busqueda));
  const activos = (tipo: ItemCatalogo["tipo"]) => items.filter((i) => i.tipo === tipo && i.activo).length;

  return (
    <View style={estiloPanel}>
      <View style={estilos.cabecera}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="titulo" tamano={26}>Servicios</Texto>
          <Texto variante="subtitulo" tamano={13}>{`${activos("servicio")} servicios y ${activos("especialidad")} especialidades activos`}</Texto>
        </View>
        <Boton titulo="Agregar" icono="mas" alto={42} onPress={() => setAbierto("nuevo")} />
      </View>
      <BuscadorAdmin placeholder="Buscar servicio o especialidad..." valor={busqueda} alCambiar={setBusqueda} />
      <FiltrosAdmin opciones={FILTROS} elegido={filtro} alElegir={setFiltro} cantidad={(e) => items.filter((i) => cumple(i, e)).length} />
      {items.length === 0 ? (
        <Texto variante="chico" tamano={13.5} style={{ marginTop: 14 }}>No se pudo cargar el catálogo. Revisá la conexión.</Texto>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          {lista.map((i) => <FilaServicio key={i.nombre} item={i} alAbrir={() => setAbierto(i)} />)}
          {lista.length === 0 ? <Texto variante="chico" tamano={13.5} style={{ marginTop: 14 }}>No hay nada con ese nombre.</Texto> : null}
        </ScrollView>
      )}
      {abierto ? <HojaServicio item={abierto === "nuevo" ? null : abierto} alCerrar={() => setAbierto(null)} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center", gap: 12 },
  etiqueta: { marginTop: 14, marginBottom: 6 },
  fila: { marginTop: 10 },
  filaContenido: { flexDirection: "row", alignItems: "center", gap: 6 },
  icono: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
