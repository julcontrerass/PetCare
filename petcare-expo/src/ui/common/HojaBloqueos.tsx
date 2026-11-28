/*
 * Bloqueos de agenda de un veterinario (la usan el veterinario y su recepción): los que siguen vigentes, con la opción
 * de quitarlos, y "Bloquear horario" para cargar uno nuevo (un día entero, varios días o unas horas, con el motivo).
 * Si el bloqueo cae sobre turnos ya dados, se elige cancelarlos (a los dueños les llega el aviso con el motivo) o
 * dejarlos; después se muestra a quién escribirle por WhatsApp.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BloqueosRepo } from "../../data/repositorio/bloqueosRepo";
import type { BloqueoAfectadoDto } from "../../data/remoto/dtos";
import { MOTIVOS_BLOQUEO, textoBloqueo, type Bloqueo } from "../../model/bloqueos";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate, LocalDateTime } from "../../util/tiempo";
import { ChipRegistro, GrupoChips } from "../auth/ChipRegistro";
import { SelectorHoraLibre } from "../auth/SelectorHoraLibre";
import { Avisos } from "./Avisos";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import { Contacto } from "./Contacto";
import { HojaInferior } from "./HojaInferior";
import { Icono } from "./Icono";
import { SelectorFecha } from "./SelectorFecha";
import { Tarjeta } from "./Tarjeta";
import { Texto } from "./Texto";
import { Colores } from "./tema";

export interface HojaBloqueosProps {
  visible: boolean;
  veterinarioId: string;
  /** Nombre del veterinario, para el mensaje a los dueños. */
  veterinario: string;
  /** Turnos pendientes de ese veterinario entre [desde] y [hasta] (lo que ya tiene cargado quien llama). */
  turnosEntre: (desde: LocalDateTime, hasta: LocalDateTime) => number;
  /** Después de crear o quitar un bloqueo (para recargar la agenda). */
  alCambiar: () => void;
  alCerrar: () => void;
}

type Pantalla = { tipo: "lista" } | { tipo: "nuevo" } | { tipo: "resultado"; afectados: BloqueoAfectadoDto[]; motivo: string };

function mensajeAlDueno(a: BloqueoAfectadoDto, veterinario: string, motivo: string): string {
  const fecha = LocalDate.parse(a.fecha);
  const cuando = `${Fechas.corta(fecha)} a las ${a.hora.slice(0, 5)} hs`;
  const saludo = a.dueno ? `Hola ${a.dueno.split(" ")[0]}` : "Hola";
  return a.cancelado
    ? `${saludo}, te escribimos de parte de ${veterinario}. Tuvimos que cancelar el turno de ${a.mascota} del ${cuando} (${motivo.toLowerCase()}). Podés sacar otro desde PetCare o respondernos por acá.`
    : `${saludo}, te escribimos de parte de ${veterinario}. El turno de ${a.mascota} del ${cuando} cae en un horario en que no vamos a poder atender (${motivo.toLowerCase()}). ¿Lo pasamos a otro día?`;
}

function FilaBloqueo({ b, alQuitar }: { b: Bloqueo; alQuitar: () => void }) {
  return (
    <Tarjeta relleno={12} estilo={estilos.fila} accessibilityLabel={`${b.motivo}: ${textoBloqueo(b)}`}>
      <View style={estilos.filaContenido}>
        <View style={estilos.icono}><Icono nombre="calendario" tamano={20} color={Colores.dangerRed} /></View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Texto tamano={15} negrita numberOfLines={1}>{b.motivo}</Texto>
          <Texto variante="chico" tamano={13}>{textoBloqueo(b)}</Texto>
        </View>
        <Boton titulo="Quitar" variante="texto" alto={40} onPress={alQuitar} />
      </View>
    </Tarjeta>
  );
}

function FormularioBloqueo({ veterinarioId, turnosEntre, alListo, alVolver }: {
  veterinarioId: string;
  turnosEntre: HojaBloqueosProps["turnosEntre"];
  alListo: (afectados: BloqueoAfectadoDto[], motivo: string) => void;
  alVolver: () => void;
}) {
  const hoy = LocalDate.now();
  const [motivo, setMotivo] = useState<string>(MOTIVOS_BLOQUEO[0]);
  const [otro, setOtro] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [todoElDia, setTodoElDia] = useState(true);
  const [horaDesde, setHoraDesde] = useState("09:00");
  const [horaHasta, setHoraHasta] = useState("13:00");
  const [eligiendoFecha, setEligiendoFecha] = useState<"desde" | "hasta" | null>(null);
  const [eligiendoHora, setEligiendoHora] = useState<"desde" | "hasta" | null>(null);
  const [guardando, setGuardando] = useState(false);

  const motivoFinal = motivo === "Otro" ? otro.trim() : motivo;
  const [hd, md] = horaDesde.split(":").map(Number);
  const [hh, mh] = horaHasta.split(":").map(Number);
  const inicio = todoElDia ? LocalDateTime.ofDate(desde) : LocalDateTime.ofDate(desde, hd, md);
  const fin = todoElDia ? LocalDateTime.ofDate(hasta.plusDays(1)) : LocalDateTime.ofDate(hasta, hh, mh);
  const problema =
    motivoFinal.length < 2 ? "Escribí el motivo"
      : hasta.isBefore(desde) ? "El último día no puede ser antes del primero"
        : !inicio.isBefore(fin) ? "La hora de fin tiene que ser posterior a la de inicio"
          : !LocalDateTime.now().isBefore(fin) ? "Ese horario ya pasó"
            : null;
  const afectados = problema ? 0 : turnosEntre(inicio, fin);

  const guardar = async (cancelar: boolean) => {
    if (problema) return;
    setGuardando(true);
    try {
      const lista = await BloqueosRepo.crear(veterinarioId, inicio, fin, motivoFinal, cancelar);
      alListo(lista, motivoFinal);
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setGuardando(false);
    }
  };

  return (
    <View>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">Bloquear horario</Texto>
      <Texto variante="subtitulo" tamano={13}>En ese horario nadie va a poder sacar un turno.</Texto>

      <Texto variante="etiqueta" style={estilos.etiqueta}>Motivo</Texto>
      <GrupoChips espacioVertical={4}>
        {[...MOTIVOS_BLOQUEO, "Otro"].map((m) => <ChipRegistro key={m} texto={m} marcado={motivo === m} alCambiar={() => setMotivo(m)} />)}
      </GrupoChips>
      {motivo === "Otro" ? (
        <Campo estilo={{ marginTop: 8 }} etiqueta="¿Cuál?" placeholder="Ej: Congreso" value={otro} onChangeText={setOtro} maxLength={120} />
      ) : null}

      <Texto variante="etiqueta" style={estilos.etiqueta}>Días</Texto>
      <View style={estilos.dos}>
        <Boton titulo={`Desde ${Fechas.corta(desde)}`} variante="secundario" alto={46} estilo={{ flex: 1 }} onPress={() => setEligiendoFecha("desde")} />
        <Boton titulo={`Hasta ${Fechas.corta(hasta)}`} variante="secundario" alto={46} estilo={{ flex: 1 }} onPress={() => setEligiendoFecha("hasta")} />
      </View>

      <Texto variante="etiqueta" style={estilos.etiqueta}>Horario</Texto>
      <GrupoChips espacioVertical={4}>
        <ChipRegistro texto="Todo el día" marcado={todoElDia} alCambiar={() => setTodoElDia(true)} />
        <ChipRegistro texto="Unas horas" marcado={!todoElDia} alCambiar={() => setTodoElDia(false)} />
      </GrupoChips>
      {todoElDia ? null : (
        <View style={[estilos.dos, { marginTop: 6 }]}>
          <Boton titulo={`De ${horaDesde} hs`} variante="secundario" alto={46} estilo={{ flex: 1 }} onPress={() => setEligiendoHora("desde")} />
          <Boton titulo={`A ${horaHasta} hs`} variante="secundario" alto={46} estilo={{ flex: 1 }} onPress={() => setEligiendoHora("hasta")} />
        </View>
      )}

      {problema ? (
        <Texto variante="chico" tamano={13} color={Colores.dangerRed} style={{ marginTop: 14 }}>{problema}</Texto>
      ) : afectados > 0 ? (
        <View style={estilos.aviso}>
          <Texto tamano={14} negrita color={Colores.accentOrangeDark}>
            {afectados === 1 ? "Hay 1 turno dado en ese horario" : `Hay ${afectados} turnos dados en ese horario`}
          </Texto>
          <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>
            Si los cancelás, a cada dueño le llega el aviso con el motivo. Si los dejás, después podés moverlos desde la agenda.
          </Texto>
        </View>
      ) : null}

      {afectados > 0 ? (
        <>
          <Boton
            titulo={afectados === 1 ? "Bloquear y cancelar el turno" : `Bloquear y cancelar los ${afectados} turnos`}
            variante="peligro" alto={50} estilo={{ marginTop: 14 }} cargando={guardando} deshabilitado={problema != null}
            onPress={() => void guardar(true)}
          />
          <Boton
            titulo="Bloquear y dejar los turnos" variante="secundario" alto={48} estilo={{ marginTop: 8 }}
            deshabilitado={guardando || problema != null} onPress={() => void guardar(false)}
          />
        </>
      ) : (
        <Boton titulo="Bloquear" alto={50} estilo={{ marginTop: 16 }} cargando={guardando} deshabilitado={problema != null} onPress={() => void guardar(false)} />
      )}
      <Boton titulo="Volver" variante="texto" alto={46} estilo={{ marginTop: 4 }} deshabilitado={guardando} onPress={alVolver} />

      <SelectorFecha
        visible={eligiendoFecha != null} valor={eligiendoFecha === "hasta" ? hasta : desde} minima={eligiendoFecha === "hasta" ? desde : hoy}
        titulo={eligiendoFecha === "hasta" ? "Último día bloqueado" : "Primer día bloqueado"}
        alElegir={(f) => {
          if (eligiendoFecha === "hasta") setHasta(f);
          else {
            setDesde(f);
            if (hasta.isBefore(f)) setHasta(f);
          }
          setEligiendoFecha(null);
        }}
        alCerrar={() => setEligiendoFecha(null)}
      />
      <SelectorHoraLibre
        visible={eligiendoHora != null} valor={eligiendoHora === "hasta" ? horaHasta : horaDesde}
        titulo={eligiendoHora === "hasta" ? "Hasta qué hora" : "Desde qué hora"}
        alElegir={(h) => (eligiendoHora === "hasta" ? setHoraHasta(h) : setHoraDesde(h))}
        alCerrar={() => setEligiendoHora(null)}
      />
    </View>
  );
}

export function HojaBloqueos({ visible, veterinarioId, veterinario, turnosEntre, alCambiar, alCerrar }: HojaBloqueosProps) {
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: "lista" });
  const cerrar = () => {
    setPantalla({ tipo: "lista" });
    alCerrar();
  };
  const quitar = (b: Bloqueo) =>
    Avisos.confirmar({
      titulo: "¿Quitar el bloqueo?",
      mensaje: `${b.motivo}: ${textoBloqueo(b)}. Ese horario vuelve a estar disponible para sacar turnos.`,
      textoAceptar: "Quitar bloqueo",
      alAceptar: () => {
        BloqueosRepo.eliminar(b)
          .then(() => {
            Avisos.mostrar("Bloqueo quitado");
            alCambiar();
          })
          .catch((e) => Avisos.error(Errores.mensaje(e)));
      },
    });

  const lista = BloqueosRepo.de(veterinarioId);
  return (
    <HojaInferior visible={visible} alCerrar={cerrar}>
      {pantalla.tipo === "nuevo" ? (
        <FormularioBloqueo
          veterinarioId={veterinarioId} turnosEntre={turnosEntre}
          alVolver={() => setPantalla({ tipo: "lista" })}
          alListo={(afectados, motivo) => {
            alCambiar();
            if (afectados.length === 0) {
              Avisos.mostrar("Listo: bloqueaste ese horario", "exito");
              setPantalla({ tipo: "lista" });
            } else {
              setPantalla({ tipo: "resultado", afectados, motivo });
            }
          }}
        />
      ) : pantalla.tipo === "resultado" ? (
        <View>
          <Texto variante="titulo" tamano={20} accessibilityRole="header">Horario bloqueado</Texto>
          <Texto variante="subtitulo" tamano={13}>
            {pantalla.afectados[0]?.cancelado
              ? "Cancelamos estos turnos y les avisamos a los dueños en la app. Si querés, escribiles también por WhatsApp."
              : "Estos turnos quedaron en pie. Avisales a los dueños para pasarlos a otro día."}
          </Texto>
          {pantalla.afectados.map((a) => (
            <Tarjeta key={a.turno_id} relleno={12} estilo={estilos.fila}>
              <Texto tamano={15} negrita>{`${a.mascota} · ${Fechas.corta(LocalDate.parse(a.fecha))} ${a.hora.slice(0, 5)} hs`}</Texto>
              <Texto variante="chico" tamano={13}>{a.dueno ?? "Dueño sin nombre"}</Texto>
              <Boton
                titulo="Escribir por WhatsApp" icono="whatsapp" variante="secundario" alto={42} estilo={{ marginTop: 8 }}
                deshabilitado={!a.telefono}
                onPress={() => {
                  const mensaje = mensajeAlDueno(a, veterinario, pantalla.motivo);
                  void Contacto.abrir(Contacto.whatsApp(a.telefono ?? "", mensaje) ?? Contacto.compartirTexto(mensaje), "No pudimos abrir WhatsApp");
                }}
              />
            </Tarjeta>
          ))}
          <Boton titulo="Listo" alto={50} estilo={{ marginTop: 16 }} onPress={() => setPantalla({ tipo: "lista" })} />
        </View>
      ) : (
        <View>
          <Texto variante="titulo" tamano={20} accessibilityRole="header">Bloqueos de agenda</Texto>
          <Texto variante="subtitulo" tamano={13}>
            Cirugías, viajes, feriados o cualquier momento en que no atiendas. La pausa de todos los días se carga en cada lugar del perfil.
          </Texto>
          {lista.length === 0 ? (
            <Texto variante="chico" tamano={13.5} style={{ marginTop: 14 }}>No tenés horarios bloqueados.</Texto>
          ) : (
            lista.map((b) => <FilaBloqueo key={b.id} b={b} alQuitar={() => quitar(b)} />)
          )}
          <Boton titulo="Bloquear horario" icono="mas" alto={50} estilo={{ marginTop: 16 }} onPress={() => setPantalla({ tipo: "nuevo" })} />
          <Boton titulo="Cerrar" variante="texto" alto={46} estilo={{ marginTop: 4 }} onPress={cerrar} />
        </View>
      )}
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { marginTop: 14, marginBottom: 6 },
  dos: { flexDirection: "row", gap: 10 },
  fila: { marginTop: 10 },
  filaContenido: { flexDirection: "row", alignItems: "center" },
  icono: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colores.lightRed, alignItems: "center", justifyContent: "center" },
  aviso: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: Colores.lightOrange },
});
