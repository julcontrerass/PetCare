/*
 * Hoy, la pantalla principal de la recepción: los turnos del día de todos los veterinarios (o de uno, con el
 * filtro), por hora, con cuántos ya llegaron. Tocar un turno abre sus acciones: marcar la llegada, moverlo,
 * cancelarlo o escribirle al dueño.
 */
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ClinicasRepo } from "../../data/repositorio/clinicasRepo";
import { RecepcionAgendaRepo, type TurnoRecepcion } from "../../data/repositorio/recepcionAgendaRepo";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { EstadoVacio } from "../common/EstadoVacio";
import { LogoVeterinaria } from "../common/LogoVeterinaria";
import { PantallaBase } from "../common/PantallaBase";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { useDatos } from "../common/useDatos";
import { useEscritorio } from "../common/Web";
import { FiltroVeterinarios, SinVeterinarios, TarjetaTurno, TurnoHoja } from "./ElementosRecepcion";
import { NavRecepcion } from "./navegacionRecepcion";
import { EditorTurnoRecepcion } from "./EditorTurnoRecepcion";

function Resumen({ valor, etiqueta, color }: { valor: number; etiqueta: string; color: string }) {
  return (
    <View style={estilos.resumen}>
      <Texto variante="titulo" tamano={22} color={color}>{String(valor)}</Texto>
      <Texto variante="chico" tamano={12}>{etiqueta}</Texto>
    </View>
  );
}

export function HoyRecepcion() {
  useDatos();
  const escritorio = useEscritorio();
  const [vet, setVet] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<TurnoRecepcion | null>(null);
  const sinVets = RecepcionAgendaRepo.veterinarios.length === 0;
  const turnos = RecepcionAgendaRepo.deHoy(vet);
  const enEspera = turnos.filter((t) => t.llegada === "en_espera").length;
  const faltan = turnos.filter((t) => t.llegada == null).length;
  // Mismo formato que el inicio del veterinario: "Miércoles 25 de noviembre"
  const hoy = LocalDate.now();
  const fecha = `${Fechas.diaSemana(hoy)} ${hoy.dayOfMonth} de ${Fechas.nombreMes(hoy.monthValue).toLowerCase()}`;

  // En el teléfono el encabezado lleva el logo y el nombre de la veterinaria (en escritorio están en el menú)
  const clinica = escritorio ? null : ClinicasRepo.principal;
  return (
    <PantallaBase
      titulo="Hoy" subtitulo={clinica ? `${clinica.nombre} · ${fecha}` : fecha} scroll={false} bordes={["top"]}
      derecha={clinica ? <LogoVeterinaria logoPath={clinica.logo_path} nombre={clinica.nombre} tamano={44} /> : undefined}
    >
      {sinVets ? (
        <SinVeterinarios />
      ) : (
        <>
          <FiltroVeterinarios elegido={vet} alElegir={setVet} />
          <View style={estilos.resumenes}>
            <Resumen valor={turnos.length} etiqueta={turnos.length === 1 ? "Turno" : "Turnos"} color={Colores.brandNavy} />
            <Resumen valor={enEspera} etiqueta="En sala de espera" color={Colores.successGreen} />
            <Resumen valor={faltan} etiqueta="Por llegar" color={Colores.accentOrangeDark} />
          </View>
          {turnos.length === 0 ? (
            <EstadoVacio
              icono="calendario" titulo="No hay más turnos hoy" mensaje="Los turnos del día aparecen acá, por hora."
              textoBoton="Sacar un turno" alBoton={() => NavRecepcion.nuevoTurno(vet)}
            />
          ) : (
            <FlatList
              data={turnos}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => <TarjetaTurno turno={item} alTocar={() => setAbierto(item.id)} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          )}
        </>
      )}
      {abierto ? (
        <TurnoHoja
          turnoId={abierto} alCerrar={() => setAbierto(null)}
          alMover={(t) => { setAbierto(null); setMoviendo(t); }}
        />
      ) : null}
      {moviendo ? <EditorTurnoRecepcion turno={moviendo} alCerrar={() => setMoviendo(null)} /> : null}
    </PantallaBase>
  );
}

export default HoyRecepcion;

const estilos = StyleSheet.create({
  resumenes: { flexDirection: "row", gap: 10, marginBottom: 12 },
  resumen: {
    flex: 1, backgroundColor: Colores.white, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1,
    borderColor: Colores.dividerLight,
  },
});
