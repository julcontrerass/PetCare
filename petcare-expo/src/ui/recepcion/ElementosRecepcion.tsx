/*
 * Piezas que comparten las pantallas de la recepción: el filtro por veterinario, la tarjeta de un turno (como la de
 * la agenda del veterinario), la hoja con el detalle y las acciones de un turno, y lo que se ve mientras la cuenta
 * todavía no trabaja para ningún veterinario.
 */
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { EstadosEvento, type EstadoEvento } from "../../data/repositorio/agendaRepo";
import { RecepcionAgendaRepo, type Llegada, type TurnoRecepcion } from "../../data/repositorio/recepcionAgendaRepo";
import { RecepcionRepo } from "../../data/repositorio/recepcionRepo";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Chip, type TonoChip } from "../common/Chip";
import { Contacto } from "../common/Contacto";
import { EstadoVacio } from "../common/EstadoVacio";
import { HojaInferior } from "../common/HojaInferior";
import { Icono } from "../common/Icono";
import { RecepcionHoja } from "../common/RecepcionHoja";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";

const TONO_ESTADO: Record<EstadoEvento, TonoChip> = { PENDIENTE: "aviso", COMPLETADO: "ok", CANCELADO: "peligro" };

/** El chip de un turno: si es de hoy y se marcó la llegada, eso; si no, su estado. */
export function chipDeTurno(t: TurnoRecepcion): { texto: string; tono: TonoChip } {
  if (t.estado === "PENDIENTE" && t.llegada === "en_espera") return { texto: "En sala de espera", tono: "ok" };
  if (t.estado === "PENDIENTE" && t.llegada === "no_vino") return { texto: "No vino", tono: "peligro" };
  return { texto: EstadosEvento[t.estado].etiqueta, tono: TONO_ESTADO[t.estado] };
}

/** Chips "Todos" y uno por veterinario; no se muestra si la cuenta trabaja para uno solo. */
export function FiltroVeterinarios({ elegido, alElegir }: { elegido: string | null; alElegir: (vetId: string | null) => void }) {
  const vets = RecepcionAgendaRepo.veterinarios;
  if (vets.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtro} style={{ flexGrow: 0 }}>
      <Chip texto="Todos" tono={elegido == null ? "seleccionado" : "sinSeleccionar"} onPress={() => alElegir(null)} />
      {vets.map((v) => (
        <Chip key={v.id} texto={v.nombre} tono={elegido === v.id ? "seleccionado" : "sinSeleccionar"} onPress={() => alElegir(v.id)} />
      ))}
    </ScrollView>
  );
}

/** Un turno en la lista: hora, paciente, servicio y dueño, el veterinario (si hay varios) y su estado. */
export function TarjetaTurno({ turno: t, conFecha = false, alTocar }: { turno: TurnoRecepcion; conFecha?: boolean; alTocar: () => void }) {
  const p = RecepcionAgendaRepo.paciente(t.mascotaId);
  const vet = RecepcionAgendaRepo.veterinarios.length > 1 ? RecepcionAgendaRepo.veterinario(t.vetId) : null;
  const lugar = vet && vet.sedes.length > 1 ? vet.sede(t.sedeId) : null;
  const chip = chipDeTurno(t);
  const detalle = [`${t.tipo} · ${p?.dueno ?? ""}`, vet ? vet.nombre + (lugar ? ` · ${lugar.nombre}` : "") : null].filter(Boolean).join("\n");
  return (
    <Tarjeta onPress={alTocar} relleno={12} estilo={{ marginBottom: 10 }} accessibilityLabel={`${t.hora} ${p?.nombre ?? "Paciente"}, ${chip.texto}`}>
      <View style={estilos.turno}>
        <View style={estilos.hora}>
          <Texto variante="etiqueta" tamano={15} color={Colores.tealDark}>{t.hora}</Texto>
          {conFecha ? <Texto variante="chico" tamano={10.5} color={Colores.tealDark}>{Fechas.corta(t.fecha)}</Texto> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, marginHorizontal: 12 }}>
          <View style={estilos.nombre}>
            <Texto variante="cuerpo" tamano={16} negrita numberOfLines={1} style={{ flexShrink: 1 }}>{p?.nombre ?? "Paciente"}</Texto>
            {p?.alertas.trim() ? <Icono nombre="advertencia" tamano={16} color={Colores.accentOrangeDark} /> : null}
          </View>
          <Texto variante="chico" tamano={13} numberOfLines={2}>{detalle}</Texto>
          <Chip texto={chip.texto} tono={chip.tono} estilo={{ marginTop: 6 }} />
        </View>
        <Avatar nombre={p?.nombre} fotoPath={p?.fotoPath ?? null} tamano={36} estilo={{ marginLeft: 8, marginRight: 6 }} />
        <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
      </View>
    </Tarjeta>
  );
}

function Dato({ icono, texto }: { icono: "calendario" | "reloj" | "sede" | "veterinario" | "persona" | "telefono"; texto: string }) {
  return (
    <View style={estilos.dato}>
      <Icono nombre={icono} tamano={18} color={Colores.tealDark} />
      <Texto variante="cuerpo" tamano={14.5} style={{ flex: 1, marginLeft: 10 }}>{texto}</Texto>
    </View>
  );
}

/**
 * Detalle de un turno con lo que la recepción puede hacer: marcar la llegada (solo el día del turno), moverlo,
 * cancelarlo y contactar al dueño. Completarlo queda para el veterinario, en la consulta.
 */
export function TurnoHoja({ turnoId, alCerrar, alMover }: { turnoId: string; alCerrar: () => void; alMover: (t: TurnoRecepcion) => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const t = RecepcionAgendaRepo.turno(turnoId);
  if (!t) return null;
  const p = RecepcionAgendaRepo.paciente(t.mascotaId);
  const vet = RecepcionAgendaRepo.veterinario(t.vetId);
  const lugar = vet?.sede(t.sedeId) ?? null;
  const chip = chipDeTurno(t);
  const hoy = LocalDate.now();
  const pendiente = t.estado === "PENDIENTE";
  const esHoy = t.fecha.equals(hoy);

  const hacer = async (clave: string, accion: () => Promise<void>, exito: string) => {
    setOcupado(clave);
    try {
      await accion();
      Avisos.mostrar(exito, "exito");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setOcupado(null);
    }
  };
  const llegada = (valor: Llegada | null, exito: string) =>
    void hacer(valor ?? "quitar", () => RecepcionAgendaRepo.marcarLlegada(t, valor), exito);

  const cancelar = () =>
    Avisos.confirmar({
      titulo: "¿Cancelar el turno?",
      mensaje: `${p?.nombre ?? "El paciente"} tenía ${t.tipo.toLowerCase()} el ${Fechas.corta(t.fecha)} a las ${t.hora}. Le avisamos al dueño.`,
      textoAceptar: "Cancelar turno", textoCancelar: "Volver", peligro: true, icono: "calendario",
      alAceptar: () => void hacer("cancelar", () => RecepcionAgendaRepo.cancelar(t), "Turno cancelado").then(alCerrar),
    });

  const mensaje = `Hola ${p?.dueno.split(" ")[0] ?? ""}, te escribimos de ${vet?.nombre ?? "la veterinaria"} para confirmar el turno de ` +
    `${p?.nombre ?? "tu mascota"} el ${Fechas.corta(t.fecha)} a las ${t.hora}` + (lugar ? ` en ${lugar.nombre}` : "") + ". ¿Nos confirmás si vienen?";

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <View style={estilos.cabecera}>
        <Avatar nombre={p?.nombre} fotoPath={p?.fotoPath ?? null} tamano={52} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Texto variante="titulo" tamano={20} accessibilityRole="header" numberOfLines={1}>{p?.nombre ?? "Paciente"}</Texto>
          <Texto variante="chico" tamano={13}>{`${t.tipo}${t.motivo !== t.tipo ? ` · ${t.motivo}` : ""}`}</Texto>
        </View>
        <Chip texto={chip.texto} tono={chip.tono} />
      </View>

      {p?.alertas.trim() ? (
        <View style={estilos.alerta}>
          <Icono nombre="advertencia" tamano={18} color={Colores.accentOrangeDark} />
          <Texto variante="cuerpo" tamano={13.5} style={{ flex: 1, marginLeft: 8 }}>{p.alertas}</Texto>
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <Dato icono="calendario" texto={`${Fechas.relativa(t.fecha)} · ${Fechas.corta(t.fecha)}`} />
        <Dato icono="reloj" texto={`${t.hora} · ${t.duracionMin} min`} />
        {vet ? <Dato icono="veterinario" texto={vet.nombre} /> : null}
        {lugar ? <Dato icono="sede" texto={lugar.direccion ? `${lugar.nombre} · ${lugar.direccion}` : lugar.nombre} /> : null}
        <Dato icono="persona" texto={p?.dueno ?? "Sin dueño cargado"} />
        {p?.telefono ? <Dato icono="telefono" texto={p.telefono} /> : null}
        {t.notas.trim() ? <Texto variante="chico" tamano={13} style={{ marginTop: 8 }}>{`Notas: ${t.notas}`}</Texto> : null}
      </View>

      {pendiente && esHoy ? (
        <View style={estilos.botones}>
          {t.llegada === "en_espera" ? (
            <Boton titulo="Quitar llegada" variante="secundario" alto={46} estilo={{ flex: 1 }} cargando={ocupado === "quitar"} deshabilitado={ocupado != null} onPress={() => llegada(null, "Se quitó la llegada")} />
          ) : (
            <Boton titulo="Llegó" icono="check" alto={46} estilo={{ flex: 1 }} cargando={ocupado === "en_espera"} deshabilitado={ocupado != null} onPress={() => llegada("en_espera", "Avisamos que está en sala de espera")} />
          )}
          {t.llegada === "no_vino" ? (
            <Boton titulo="Quitar 'no vino'" variante="secundario" alto={46} estilo={{ flex: 1 }} cargando={ocupado === "quitar"} deshabilitado={ocupado != null} onPress={() => llegada(null, "Se quitó la marca")} />
          ) : (
            <Boton titulo="No vino" variante="secundario" alto={46} estilo={{ flex: 1 }} cargando={ocupado === "no_vino"} deshabilitado={ocupado != null} onPress={() => llegada("no_vino", "Marcado como que no vino")} />
          )}
        </View>
      ) : null}

      {p?.telefono ? (
        <View style={estilos.botones}>
          <Boton
            titulo="WhatsApp" icono="whatsapp" variante="secundario" alto={46} estilo={{ flex: 1 }}
            onPress={() => void Contacto.abrir(Contacto.whatsApp(p.telefono!, mensaje), "No pudimos abrir WhatsApp")}
          />
          <Boton
            titulo="Llamar" icono="telefono" variante="secundario" alto={46} estilo={{ flex: 1 }}
            onPress={() => void Contacto.abrir(Contacto.llamar(p.telefono!), "No pudimos iniciar la llamada")}
          />
        </View>
      ) : null}

      {pendiente ? (
        <>
          <Boton titulo="Mover turno" icono="calendario" alto={50} estilo={{ marginTop: 14 }} deshabilitado={ocupado != null} onPress={() => alMover(t)} />
          <Boton titulo="Cancelar turno" variante="peligroContorno" alto={50} estilo={{ marginTop: 8 }} cargando={ocupado === "cancelar"} deshabilitado={ocupado != null} onPress={cancelar} />
        </>
      ) : null}
    </HojaInferior>
  );
}

/**
 * Lo que se ve mientras la cuenta no tiene ningún veterinario activo: si hay un pedido esperando, para quién; si
 * no, cómo pedir sumarse.
 */
export function SinVeterinarios() {
  const [hoja, setHoja] = useState(false);
  const pendientes = RecepcionRepo.misVeterinarios.filter((v) => v.estado === "pendiente");
  const esperando = pendientes.filter((v) => !v.me_toca_responder);
  const porResponder = pendientes.filter((v) => v.me_toca_responder);
  let titulo = "Todavía no trabajás para ningún veterinario";
  let mensaje = "Pedile a tu veterinario que te invite, o pedí sumarte a su recepción con su correo, DNI o matrícula.";
  if (porResponder.length > 0) {
    titulo = `${porResponder[0].nombre} te invitó a su recepción`;
    mensaje = "Aceptá la invitación para ver su agenda.";
  } else if (esperando.length > 0) {
    titulo = `Esperando que ${esperando[0].nombre} acepte`;
    mensaje = "Cuando acepte tu pedido vas a ver su agenda acá. Te avisamos con una notificación.";
  }
  return (
    <>
      <EstadoVacio
        icono="personas" titulo={titulo} mensaje={mensaje}
        textoBoton={porResponder.length > 0 ? "Ver invitación" : "Pedir sumarme"} alBoton={() => setHoja(true)}
      />
      {hoja ? <RecepcionHoja lado="recepcionista" alCerrar={() => setHoja(false)} /> : null}
    </>
  );
}

const estilos = StyleSheet.create({
  filtro: { flexDirection: "row", gap: 8, paddingBottom: 12 },
  turno: { flexDirection: "row", alignItems: "center" },
  hora: { width: 62, minHeight: 46, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  nombre: { flexDirection: "row", alignItems: "center", gap: 6 },
  cabecera: { flexDirection: "row", alignItems: "center" },
  alerta: {
    flexDirection: "row", alignItems: "flex-start", marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: Colores.lightOrange,
  },
  dato: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  botones: { flexDirection: "row", gap: 10, marginTop: 14 },
});
