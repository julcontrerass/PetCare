/*
 * Migrado de ui/dueno/VeterinariosPantalla.kt (+ pantalla_veterinarios.xml, item_veterinario.xml).
 * Veterinarios con acceso a las mascotas: se puede revocar, restablecer, cambiar el vencimiento del permiso,
 * autorizar a uno nuevo del catálogo y ver el historial de permisos.
 *
 * Desvíos: los `AlertDialog` (vencimiento, historial, autorizar) son hojas inferiores del kit y el
 * `DatePickerDialog` de "Elegir una fecha…" es el `SelectorFecha`.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DuenoRepo, type EntradaPermiso } from "../../data/repositorio/duenoRepo";
import type { EstadoAcceso, VeterinarioAcceso } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { BotonIcono } from "../common/BotonIcono";
import { Campo } from "../common/Campo";
import { Chip } from "../common/Chip";
import { HojaInferior } from "../common/HojaInferior";
import { Icono } from "../common/Icono";
import { PantallaBase } from "../common/PantallaBase";
import { SelectorFecha } from "../common/SelectorFecha";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { NavDueno } from "./navegacionDueno";

type Filtro = "TODOS" | "ACTIVOS" | "INACTIVOS";

const FILTROS: { filtro: Filtro; texto: string; estado: EstadoAcceso | null }[] = [
  { filtro: "TODOS", texto: "Todos", estado: null },
  { filtro: "ACTIVOS", texto: "Con acceso", estado: "ACTIVO" },
  { filtro: "INACTIVOS", texto: "Sin acceso", estado: "INACTIVO" },
];

/** Opciones de duración del permiso; null = sin vencimiento. */
function opcionesDeVencimiento(): { nombre: string; fecha: LocalDate | null }[] {
  const hoy = LocalDate.now();
  return [
    { nombre: "Sin vencimiento", fecha: null },
    { nombre: "1 mes", fecha: hoy.plusMonths(1) },
    { nombre: "3 meses", fecha: hoy.plusMonths(3) },
    { nombre: "6 meses", fecha: hoy.plusMonths(6) },
    { nombre: "1 año", fecha: hoy.plusYears(1) },
  ];
}

function ChipFiltro({ texto, activo, alTocar }: { texto: string; activo: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ selected: activo }} onPress={alTocar}
      {...foco.props} style={[estilos.filtro, activo ? estilos.filtroActivo : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={activo ? Colores.white : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

function Accion({ texto, color, alTocar }: { texto: string; color: string; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar} {...foco.props}
      style={[{ paddingVertical: 8, alignSelf: "flex-start" }, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="cuerpo" tamano={14} negrita color={color}>{texto}</Texto>
    </Pressable>
  );
}

/** Tarjeta de un veterinario con acceso (item_veterinario.xml). */
function TarjetaVeterinario({ vet, alRevocar, alRestablecer, alVencimiento }: {
  vet: VeterinarioAcceso; alRevocar: () => void; alRestablecer: () => void; alVencimiento: () => void;
}) {
  const activo = vet.tieneAcceso;
  const turnos = DuenoRepo.turnosDeVeterinario(vet);
  const proximo = DuenoRepo.proximoTurnoDeVeterinario(vet);
  const mascotas = [...vet.mascotas];
  const textoEstado =
    activo && vet.venceEl != null ? `Con acceso hasta ${Fechas.corta(vet.venceEl)}`
    : activo ? "Con acceso"
    : vet.vencido && vet.venceEl != null ? `Venció el ${Fechas.corta(vet.venceEl)}`
    : "Sin acceso";
  return (
    <Tarjeta estilo={{ marginTop: 12, marginBottom: 2 }}>
      <View style={estilos.fila}>
        <Avatar nombre={vet.nombre.replace(/^Dra?\.\s*/, "")} fotoPath={vet.fotoPath} tamano={46} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Texto variante="titulo" tamano={16} numberOfLines={1}>{vet.nombre}</Texto>
          <Texto variante="chico" numberOfLines={1}>
            {`${vet.especialidad} · ${vet.matricula} · ${turnos === 1 ? "1 turno" : `${turnos} turnos`}`}
          </Texto>
        </View>
        <Chip texto={textoEstado} tono={activo ? "ok" : "peligro"} estilo={{ marginLeft: 8 }} />
      </View>
      {mascotas.length > 0 ? (
        <>
          <Texto variante="chico" tamano={12} style={{ marginTop: 14 }}>Puede ver la ficha de</Texto>
          <View style={estilos.mascotas}>
            {mascotas.map((n) => (
              <View key={n} style={estilos.chipMascota}>
                <Texto variante="etiqueta" tamano={12} color={Colores.tealDark}>{n}</Texto>
              </View>
            ))}
          </View>
        </>
      ) : null}
      <View style={[estilos.fila, { marginTop: 12 }]}>
        <Icono nombre="calendario" tamano={18} color={Colores.primaryTeal} />
        <Texto variante="cuerpo" tamano={13} color={Colores.tealDark} style={{ marginLeft: 8, flex: 1 }}>
          {proximo
            ? `Próximo turno: ${proximo.categoria} de ${proximo.mascota} · ${proximo.fecha.dayOfMonth} ${Fechas.mesCorto(proximo.fecha.monthValue)}, ${proximo.hora}`
            : "Sin turnos próximos"}
        </Texto>
      </View>
      <View style={estilos.divisor} />
      {activo ? (
        <Accion texto="Revocar acceso" color={Colores.dangerRed} alTocar={alRevocar} />
      ) : (
        <Accion texto="Restablecer acceso" color={Colores.primaryTeal} alTocar={alRestablecer} />
      )}
      {activo ? <Accion texto="Cambiar vencimiento" color={Colores.primaryTeal} alTocar={alVencimiento} /> : null}
    </Tarjeta>
  );
}

export default function VeterinariosPantalla() {
  useSesionRequerida();
  useDatos();
  const [, setTick] = useState(0);
  const redibujar = () => setTick((t) => t + 1);
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [consulta, setConsulta] = useState("");

  // Hoja de vencimiento: título y qué hacer con la elección
  const [vencimiento, setVencimiento] = useState<{ titulo: string; alElegir: (hasta: LocalDate | null) => void } | null>(null);
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const [historial, setHistorial] = useState(false);
  const [entradas, setEntradas] = useState<EntradaPermiso[] | null | undefined>(undefined);
  const [autorizando, setAutorizando] = useState(false);
  const [buscador, setBuscador] = useState("");

  const q = consulta.trim().toLowerCase();
  const estadoFiltro = FILTROS.find((f) => f.filtro === filtro)?.estado ?? null;
  const filtrados = DuenoRepo.autorizados.filter(
    (vet) =>
      (estadoFiltro == null || vet.estado === estadoFiltro) &&
      (q === "" || [vet.nombre, vet.usuario, vet.email, vet.matricula, ...vet.mascotas].some((t) => t.toLowerCase().includes(q))),
  );
  const conAcceso = DuenoRepo.autorizados.filter((v) => v.tieneAcceso).length;

  /** Pregunta por cuánto tiempo y llama a [alElegir] con la fecha límite (null = sin vencimiento). */
  const elegirVencimiento = (titulo: string, alElegir: (hasta: LocalDate | null) => void) => setVencimiento({ titulo, alElegir });

  useEffect(() => {
    if (!historial) return;
    let vigente = true;
    setEntradas(undefined);
    void (async () => {
      let lista: EntradaPermiso[] | null;
      try {
        lista = await DuenoRepo.historialDePermisos();
      } catch {
        lista = null;
      }
      if (vigente) setEntradas(lista);
    })();
    return () => {
      vigente = false;
    };
  }, [historial]);

  const revocar = (vet: VeterinarioAcceso) =>
    Avisos.confirmar({
      titulo: "Revocar acceso",
      mensaje: `${vet.nombre} dejará de ver las fichas de tus mascotas hasta que agendes un nuevo turno.`,
      textoAceptar: "Revocar",
      textoCancelar: "Cancelar",
      alAceptar: () => {
        DuenoRepo.revocarAcceso(vet);
        redibujar();
        Avisos.mostrar(`Se revocó la autorización de ${vet.nombre}`);
      },
    });

  const restablecer = (vet: VeterinarioAcceso) =>
    elegirVencimiento("¿Por cuánto tiempo?", (hasta) => {
      DuenoRepo.restablecerAcceso(vet, hasta);
      redibujar();
      Avisos.mostrar(`Veterinario ${vet.nombre} autorizado correctamente`);
    });

  const cambiarVencimiento = (vet: VeterinarioAcceso) =>
    elegirVencimiento("Vencimiento del permiso", (hasta) => {
      DuenoRepo.cambiarVencimiento(vet, hasta);
      redibujar();
      Avisos.mostrar(hasta == null ? "El permiso ya no vence" : `El permiso vence el ${Fechas.corta(hasta)}`);
    });

  const candidatos = autorizando ? DuenoRepo.candidatosAAutorizar(buscador) : [];

  const autorizar = (vet: VeterinarioAcceso) => {
    setAutorizando(false);
    elegirVencimiento("¿Por cuánto tiempo?", (hasta) => {
      DuenoRepo.autorizarVeterinario(vet, hasta);
      redibujar();
      Avisos.mostrar(`Veterinario ${vet.nombre} autorizado correctamente`);
    });
  };

  const elegida = (hasta: LocalDate | null) => {
    const v = vencimiento;
    setVencimiento(null);
    v?.alElegir(hasta);
  };

  return (
    <PantallaBase
      titulo="Veterinarios"
      subtitulo={conAcceso === 1 ? "1 con acceso a tus mascotas" : `${conAcceso} con acceso a tus mascotas`}
      alVolver={() => NavDueno.irAHome()}
      derecha={
        <BotonIcono
          icono="mas" accessibilityLabel="Autorizar nuevo veterinario"
          onPress={() => {
            setBuscador("");
            setAutorizando(true);
          }}
        />
      }
    >
      <Pressable
        accessibilityRole="button" accessibilityLabel="Historial de permisos" onPress={() => setHistorial(true)}
        style={[{ alignSelf: "flex-start", paddingVertical: 6 }, cursorTocable]}
      >
        <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>Historial de permisos</Texto>
      </Pressable>

      <View style={[estilos.fila, estilos.aviso]}>
        <Icono nombre="info" tamano={22} color={Colores.primaryTeal} />
        <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark} style={{ flex: 1, marginLeft: 12 }}>
          Los veterinarios con un turno tuyo ven la ficha de tu mascota automáticamente. No hace falta autorizarlos.
        </Texto>
      </View>

      <Campo
        estilo={{ marginTop: 14 }} icono="buscar" placeholder="Buscar por nombre, usuario, mail o matrícula…" value={consulta}
        onChangeText={setConsulta} returnKeyType="search" autoCorrect={false}
      />

      <View style={[estilos.fila, { marginTop: 12, gap: 10 }]}>
        {FILTROS.map((f) => (
          <ChipFiltro key={f.filtro} texto={f.texto} activo={f.filtro === filtro} alTocar={() => setFiltro(f.filtro)} />
        ))}
      </View>

      <View>
        {filtrados.map((vet) => (
          <TarjetaVeterinario
            key={vet.id || vet.usuario || vet.nombre} vet={vet}
            alRevocar={() => revocar(vet)} alRestablecer={() => restablecer(vet)} alVencimiento={() => cambiarVencimiento(vet)}
          />
        ))}
      </View>
      {filtrados.length === 0 ? (
        <Texto variante="subtitulo" tamano={14} centrado style={{ paddingVertical: 24 }}>No se encontraron veterinarios</Texto>
      ) : null}

      <HojaInferior visible={vencimiento != null} alCerrar={() => setVencimiento(null)}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header">{vencimiento?.titulo ?? ""}</Texto>
        <View style={{ marginTop: 8 }}>
          {opcionesDeVencimiento().map((o) => {
            const texto = o.nombre + (o.fecha ? ` (hasta ${Fechas.corta(o.fecha)})` : "");
            return (
              <Pressable key={o.nombre} accessibilityRole="button" accessibilityLabel={texto} onPress={() => elegida(o.fecha)} style={[estilos.opcion, cursorTocable]}>
                <Texto variante="cuerpo">{texto}</Texto>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Elegir una fecha…" onPress={() => setEligiendoFecha(true)} style={[estilos.opcion, cursorTocable]}>
            <Texto variante="cuerpo">Elegir una fecha…</Texto>
          </Pressable>
        </View>
        <Boton titulo="Cancelar" variante="texto" estilo={{ marginTop: 8 }} onPress={() => setVencimiento(null)} />
      </HojaInferior>

      <SelectorFecha
        visible={eligiendoFecha} minima={LocalDate.now()} titulo="Elegí la fecha"
        alElegir={(d) => elegida(d)} alCerrar={() => setEligiendoFecha(false)}
      />

      <HojaInferior visible={historial} alCerrar={() => setHistorial(false)}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header">Historial de permisos</Texto>
        <View style={{ marginTop: 8 }}>
          {entradas === undefined ? (
            <Texto variante="subtitulo" tamano={14}>Cargando…</Texto>
          ) : entradas === null ? (
            <Texto variante="subtitulo" tamano={14}>No se pudo cargar el historial</Texto>
          ) : entradas.length === 0 ? (
            <Texto variante="subtitulo" tamano={14}>Todavía no hay movimientos</Texto>
          ) : (
            entradas.map((e, i) => (
              <View key={i} style={{ marginTop: 10 }}>
                <Texto variante="cuerpo" tamano={14} negrita color={Colores.black}>{e.evento}</Texto>
                <Texto variante="chico" tamano={12}>
                  {`${e.veterinario} · ${e.mascota}` + (e.venceEl ? ` · hasta ${Fechas.corta(e.venceEl)}` : "") +
                    `\n${e.actor} · ${Fechas.corta(e.cuando.toLocalDate())}, ${e.cuando.horaTexto()}`}
                </Texto>
              </View>
            ))
          )}
        </View>
        <Boton titulo="Cerrar" variante="texto" estilo={{ marginTop: 12 }} onPress={() => setHistorial(false)} />
      </HojaInferior>

      <HojaInferior visible={autorizando} alCerrar={() => setAutorizando(false)}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header">Autorizar nuevo veterinario</Texto>
        <Texto variante="subtitulo" tamano={13} style={{ marginTop: 8 }}>Buscá por usuario, mail o matrícula para autorizar a un veterinario:</Texto>
        <Campo
          estilo={{ marginTop: 10 }} icono="buscar" placeholder="Buscar por nombre, usuario, mail o matrícula…" value={buscador}
          onChangeText={setBuscador} autoCorrect={false}
        />
        <View style={{ marginTop: 12 }}>
          {candidatos.length === 0 ? (
            <Texto variante="subtitulo" tamano={13} centrado style={{ paddingVertical: 16 }}>No se encontraron nuevos veterinarios para autorizar</Texto>
          ) : (
            candidatos.map((vet) => (
              <View key={vet.id || vet.usuario} style={estilos.candidato}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Texto variante="cuerpo" tamano={14} negrita color={Colores.black}>{`${vet.nombre} (${vet.usuario})`}</Texto>
                  <Texto variante="chico" tamano={12}>{`${vet.email} • ${vet.matricula}`}</Texto>
                </View>
                <Boton titulo="Autorizar" alto={40} estilo={{ alignSelf: "auto", paddingHorizontal: 14 }} onPress={() => autorizar(vet)} />
              </View>
            ))
          )}
        </View>
      </HojaInferior>
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center" },
  aviso: { backgroundColor: "#E3F3F1", borderRadius: 16, padding: 14, marginTop: 6 },
  filtro: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22, backgroundColor: Colores.white },
  filtroActivo: { backgroundColor: Colores.primaryTeal },
  mascotas: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chipMascota: { backgroundColor: "#EEF2F1", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  divisor: { height: 1, backgroundColor: Colores.dividerLight, marginTop: 12, marginBottom: 4 },
  opcion: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  candidato: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colores.lightGray },
});
