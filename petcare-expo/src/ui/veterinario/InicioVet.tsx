/*
 * Migrado de ui/veterinario/InicioVetSeccion.kt + seccion_vet_inicio.xml: inicio del veterinario. Lo que tiene hoy
 * (tarjeta de la próxima consulta, resumen del día, sala de espera, consultas de hoy), las solicitudes pendientes y las vacunas por
 * recordar, y la campana de avisos (el panel lo dibuja el cascarón, `EstadoCascaron.abrirAvisos`).
 */
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { AgendaRepo, type EventoVet } from "../../data/repositorio/agendaRepo";
import { NotificacionesVet } from "../../data/repositorio/notificacionesVet";
import { PacientesRepo } from "../../data/repositorio/pacientesRepo";
import { SaludRepo } from "../../data/repositorio/saludRepo";
import { SolicitudesRepo } from "../../data/repositorio/solicitudesRepo";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { EstadoVacio } from "../common/EstadoVacio";
import { Icono, type NombreIcono } from "../common/Icono";
import { Insignia } from "../common/Insignia";
import { Grilla } from "../common/Grilla";
import { PantallaBase } from "../common/PantallaBase";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { FotoVet } from "../common/VetUi";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { EstadoCascaron } from "./estadoCascaronVet";
import { FilaHomeVet, type HomeVetItem } from "./HomeVetAdapter";
import { NavVet } from "./navegacionVet";
import { SalaDeEspera, textoEspera } from "./SalaDeEspera";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** El turno de hoy "en horario": a menos de 45 minutos de ahora o dentro de la misma hora. */
export function turnoEnHorario(hoy: EventoVet[], ahora: Date = new Date()): string | null {
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const encontrado = hoy.find((e) => {
    const partes = e.hora.split(":");
    const h = Number(partes[0]);
    const m = Number(partes[1]);
    if (partes.length < 2 || Number.isNaN(h) || Number.isNaN(m)) return false;
    return Math.abs(minAhora - (h * 60 + m)) <= 45 || ahora.getHours() === h;
  });
  return encontrado?.id ?? null;
}

function Tocable({ onPress, etiqueta, children, estilo }: { onPress: () => void; etiqueta: string; children: React.ReactNode; estilo?: object }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      {...foco.props}
      style={[cursorTocable, estiloFoco(foco.enfocado), estilo]}
    >
      {children}
    </Pressable>
  );
}

function Resumen({ icono, fondo, color, valor, etiqueta, alTocar }: {
  icono: NombreIcono; fondo: string; color: string; valor: string; etiqueta: string; alTocar?: () => void;
}) {
  return (
    <Tarjeta relleno={12} onPress={alTocar} accessibilityLabel={`${etiqueta}: ${valor}`} estilo={estilos.resumen}>
      <View style={{ alignItems: "center" }}>
        <View style={[estilos.cajaIcono, { backgroundColor: fondo }]}>
          <Icono nombre={icono} tamano={20} color={color} />
        </View>
        <Texto variante="cuerpo" tamano={15} negrita numberOfLines={1} style={{ marginTop: 8 }}>{valor}</Texto>
        <Texto variante="chico" tamano={11.5} centrado numberOfLines={1}>{etiqueta}</Texto>
      </View>
    </Tarjeta>
  );
}

export function InicioVet() {
  useDatos();
  const hoyFecha = LocalDate.now();
  const fecha = `${DIAS[hoyFecha.dayOfWeek - 1]} ${hoyFecha.dayOfMonth} de ${Fechas.mesAnio(hoyFecha).split(" ")[0].toLowerCase()}`;
  const aRecordar = SaludRepo.vacunasARecordar().length;
  const textoVacunas = aRecordar === 0 ? "Todo al día" : aRecordar === 1 ? "1 paciente con una dosis vencida o por vencer" : `${aRecordar} dosis vencidas o por vencer`;
  const hoy = AgendaRepo.deHoy();
  const enHorarioId = turnoEnHorario(hoy);
  const items: HomeVetItem[] = hoy.map((e) => ({
    title: PacientesRepo.nombreDe(e.pacienteId), subtitle: e.motivo, time: e.hora, type: "CONSULTA", eventoId: e.id,
    isEnHorario: e.id === enHorarioId, fotoDueno: PacientesRepo.fotoDuenoDe(e.pacienteId), llegada: e.llegada,
  }));
  const esperando = AgendaRepo.salaDeEspera();
  // Si alguien ya está en la sala de espera, el próximo es el primero que llegó
  const siguiente = esperando[0] ?? hoy.find((e) => e.id === enHorarioId) ?? hoy[0] ?? null;
  const siguienteEspera = siguiente?.llegada === "en_espera";
  const paciente = siguiente ? PacientesRepo.porId(siguiente.pacienteId) : null;
  const sinLeer = NotificacionesVet.sinLeer;

  return (
    <PantallaBase bordes={["top"]} estiloContenido={{ paddingTop: 20 }}>
      <View style={estilos.cabecera}>
        <Tocable onPress={NavVet.irAPerfil} etiqueta="Ir al perfil">
          <FotoVet tamano={48} estilo={sombra(1)} />
        </Tocable>
        <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
          <Texto variante="titulo" tamano={21} numberOfLines={1}>{`Hola, ${PerfilVetRepo.nombre}`}</Texto>
          <Texto variante="subtitulo" tamano={13}>{fecha}</Texto>
        </View>
        <View style={{ width: 42, height: 42 }}>
          <Tocable onPress={() => EstadoCascaron.abrirAvisos()} etiqueta="Notificaciones" estilo={estilos.campana}>
            <Icono nombre="notificacion" tamano={22} color={Colores.brandNavy} />
          </Tocable>
          <Insignia cantidad={sinLeer} estilo={{ position: "absolute", top: -4, right: -4 }} />
        </View>
      </View>

      <LinearGradient colors={["#02797A", "#17A58F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
        <View pointerEvents="none" style={estilos.heroPerro}>
          <Icono nombre="perro" tamano={150} color={Colores.white} />
        </View>
        <View style={estilos.heroIcono}>
          <Icono nombre={siguiente ? "calendario" : "check"} tamano={26} color={Colores.white} />
        </View>
        <View style={{ padding: 18 }}>
          <Texto variante="etiqueta" tamano={12} color="#FFFFFFD9" style={{ letterSpacing: 0.7, textTransform: "uppercase" }}>
            {!siguiente ? "Agenda libre" : siguienteEspera ? "En sala de espera" : siguiente.id === enHorarioId ? "En horario" : "Próxima consulta"}
          </Texto>
          <Texto variante="titulo" tamano={21} color={Colores.white} style={{ marginTop: 4, marginRight: 60 }}>
            {siguiente ? `${paciente?.nombre ?? "Paciente"} · ${siguiente.hora}` : "Sin consultas hoy"}
          </Texto>
          <Texto variante="chico" tamano={13.5} color="#FFFFFFEB" style={{ marginTop: 3, marginRight: 40 }}>
            {siguiente
              ? siguienteEspera
                ? `${textoEspera(siguiente.llegadaAt)} · ${siguiente.motivo}`
                : `${siguiente.motivo} · ${paciente?.propietario ?? ""}`
              : "Revisá la agenda o cargá una consulta nueva."}
          </Texto>
          <Tocable
            onPress={() => (siguiente ? NavVet.detalleEvento(siguiente.id) : NavVet.irAAgenda())}
            etiqueta={siguienteEspera ? "Atender" : siguiente ? "Ver turno" : "Ver agenda"}
            estilo={estilos.pildora}
          >
            <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>{siguienteEspera ? "Atender" : siguiente ? "Ver turno" : "Ver agenda"}</Texto>
          </Tocable>
        </View>
      </LinearGradient>

      <View style={estilos.resumenes}>
        <Resumen icono="perro" fondo={Colores.lightTeal} color={Colores.primaryTeal} valor={String(AgendaRepo.pacientesHoy())} etiqueta="Pacientes hoy" />
        <Resumen icono="reloj" fondo={Colores.lightOrange} color={Colores.accentOrange} valor={String(hoy.length)} etiqueta="Pendientes" />
        <Resumen
          icono="llave" fondo={Colores.lightPurple} color={Colores.accentPurple} valor={String(SolicitudesRepo.pendientesVeterinario())}
          etiqueta="Solicitudes" alTocar={NavVet.solicitudes}
        />
      </View>

      <Tarjeta relleno={14} onPress={NavVet.vacunasPendientes} estilo={{ marginTop: 14 }} accessibilityLabel="Vacunas a recordar">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={estilos.circuloVacuna}>
            <Icono nombre="vacuna" tamano={22} color={Colores.primaryTeal} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Texto variante="cuerpo" tamano={15} negrita>Vacunas a recordar</Texto>
            <Texto variante="chico" tamano={13}>{textoVacunas}</Texto>
          </View>
          <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
        </View>
      </Tarjeta>

      <SalaDeEspera esperando={esperando} alAbrir={(e) => NavVet.detalleEvento(e.id)} />

      <View style={estilos.encabezadoLista}>
        <Texto variante="titulo" tamano={18} style={{ flex: 1 }}>Consultas de hoy</Texto>
        <Tocable onPress={NavVet.irAAgenda} etiqueta="Ver agenda">
          <Texto variante="etiqueta" tamano={14} color={Colores.primaryTeal}>Ver agenda</Texto>
        </Tocable>
      </View>
      {items.length === 0 ? (
        <EstadoVacio icono="calendario" titulo="Sin consultas para hoy" mensaje="Cuando agenden un turno con vos aparece acá" estilo={{ marginTop: 12 }} />
      ) : (
        <Grilla columnas={2}>
          {items.map((item) => (
            <FilaHomeVet key={item.eventoId ?? item.title} item={item} alTocar={(i) => i.type === "CONSULTA" && i.eventoId && NavVet.detalleEvento(i.eventoId)} />
          ))}
        </Grilla>
      )}
    </PantallaBase>
  );
}

export default InicioVet;

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center" },
  campana: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", ...sombra(1) },
  hero: { marginTop: 18, borderRadius: 22, overflow: "hidden", ...sombra(2) },
  heroPerro: { position: "absolute", right: -16, bottom: -24, opacity: 0.13, transform: [{ rotate: "-10deg" }] },
  heroIcono: { position: "absolute", top: 18, right: 18, width: 46, height: 46, borderRadius: 14, backgroundColor: "#FFFFFF33", alignItems: "center", justifyContent: "center" },
  pildora: { alignSelf: "flex-start", marginTop: 14, backgroundColor: Colores.white, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 9 },
  resumenes: { flexDirection: "row", gap: 10, marginTop: 16 },
  resumen: { flex: 1 },
  cajaIcono: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  circuloVacuna: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  encabezadoLista: { flexDirection: "row", alignItems: "center", marginTop: 22 },
});
