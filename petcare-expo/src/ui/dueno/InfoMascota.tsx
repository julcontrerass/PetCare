/*
 * Migrado de DetalleMascotaPantalla.kt (pestaña "Información") + pantalla_mascota_info.xml: ficha de la mascota con su
 * resumen, alertas clínicas, evolución del peso, datos y acciones.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { InformesRepo } from "../../data/repositorio/informesRepo";
import { EstadosMascota, type Mascota } from "../../model/modelos";
import { LocalDate } from "../../util/tiempo";
import { Boton } from "../common/Boton";
import { ChipEstadoMascota } from "../common/ComponentesDueno";
import { AlertasClinicas, EvolucionPeso } from "../common/FichaClinica";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable } from "../common/Web";
import { iconoDeTipo } from "./ComponentesHome";
import { NavDueno } from "./navegacionDueno";
import { proximoEventoTexto } from "./MascotasPantalla";

function Estadistica({ icono, valor, etiqueta }: { icono: NombreIcono; valor: string; etiqueta: string }) {
  return (
    <View style={estilos.estadistica}>
      <View style={estilos.cajaIcono}>
        <Icono nombre={icono} tamano={20} color={Colores.primaryTeal} />
      </View>
      <Texto tamano={15} negrita numberOfLines={1} style={{ marginTop: 8 }}>{valor}</Texto>
      <Texto variante="chico" tamano={11.5} numberOfLines={1} centrado>{etiqueta}</Texto>
    </View>
  );
}

function FilaDato({ icono, etiqueta, valor, ultimo }: { icono: NombreIcono; etiqueta: string; valor: string; ultimo?: boolean }) {
  return (
    <>
      <View style={estilos.filaDato}>
        <View style={[estilos.cajaIcono, { width: 38, height: 38 }]}>
          <Icono nombre={icono} tamano={20} color={Colores.primaryTeal} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Texto variante="chico" tamano={12}>{etiqueta}</Texto>
          <Texto tamano={15} peso="medium" style={{ marginTop: 1 }}>{valor}</Texto>
        </View>
      </View>
      {ultimo ? null : <View style={estilos.divisor} />}
    </>
  );
}

export interface InfoMascotaProps {
  mascota: Mascota;
  alCambiarFoto: () => void;
  alEditar: () => void;
  alCambiarEstado: () => void;
  alDarDeBaja: () => void;
}

export function InfoMascota({ mascota: m, alCambiarFoto, alEditar, alCambiarEstado, alDarDeBaja }: InfoMascotaProps) {
  const [pesos, setPesos] = useState<Array<[LocalDate, number]>>([]);
  useEffect(() => {
    let vigente = true;
    InformesRepo.pesos(m.id).then((p) => { if (vigente) setPesos(p); }, () => {});
    return () => { vigente = false; };
  }, [m.id]);

  const proximo = proximoEventoTexto(m.nombre);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={estilos.scroll} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[Colores.primaryTeal, "#17A58F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
        <View style={estilos.heroMarca} pointerEvents="none">
          <Icono nombre="perro" tamano={150} color={Colores.white} />
        </View>
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto" onPress={alCambiarFoto} style={[estilos.marcoFoto, cursorTocable]}>
            <ImagenRemota
              fotoUri={m.fotoUri} fotoPath={m.fotoPath} estilo={estilos.foto}
              respaldo={<Icono nombre={iconoDeTipo(m.tipo)} tamano={56} color={Colores.primaryTeal} />}
            />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto" onPress={alCambiarFoto} style={[estilos.camara, cursorTocable]}>
            <Icono nombre="camara" tamano={18} color={Colores.primaryTeal} />
          </Pressable>
        </View>
        <Texto tamano={26} negrita color={Colores.white} style={{ marginTop: 12 }} accessibilityRole="header">{m.nombre}</Texto>
        <View style={estilos.tipoRaza}>
          <Icono nombre={iconoDeTipo(m.tipo)} tamano={18} color={Colores.white} />
          <Texto tamano={14} color="rgba(255,255,255,0.95)" style={{ marginLeft: 6 }}>{m.tipoRazaTexto}</Texto>
        </View>
        <Texto tamano={13} color="rgba(255,255,255,0.85)" centrado style={{ marginTop: 3 }}>{m.nacimientoSexoTexto}</Texto>
        <View style={estilos.estado}>
          <Texto tamano={12} negrita color={Colores.white}>{`Estado: ${EstadosMascota[m.estado].etiqueta}`}</Texto>
        </View>
      </LinearGradient>

      <View style={estilos.estadisticas}>
        <Estadistica icono="calendario" valor={m.edadTexto() ?? "—"} etiqueta="Edad" />
        <Estadistica icono="peso" valor={m.tienePesoValido ? m.peso : "—"} etiqueta="Peso" />
        <Estadistica icono="perro" valor={m.sexo ?? "—"} etiqueta="Sexo" />
      </View>

      <View style={[estilos.tarjeta, { padding: 16 }]}>
        <View style={estilos.saludTitulo}>
          <Texto tamano={16} negrita style={{ flex: 1 }}>Salud</Texto>
          <ChipEstadoMascota nombreMascota={m.nombre} />
        </View>
        <View style={estilos.proximo}>
          <Icono nombre="calendario" tamano={18} color={Colores.primaryTeal} />
          <Texto variante="subtitulo" tamano={13.5} style={{ marginLeft: 8, flex: 1 }}>
            {proximo ? `Próximo: ${proximo}` : "Sin eventos próximos agendados"}
          </Texto>
        </View>
        {m.alertas.trim() ? <AlertasClinicas texto={m.alertas} estilo={{ marginTop: 12 }} /> : null}
        <EvolucionPeso puntos={pesos} estilo={{ marginTop: 12 }} />
        <View style={estilos.botonesSalud}>
          <Boton titulo="Ver carnet" variante="secundario" alto={46} estilo={{ flex: 1, borderColor: Colores.primaryTeal }} onPress={() => NavDueno.abrirCarnet()} />
          <Boton titulo="Agendar turno" alto={46} estilo={{ flex: 1 }} onPress={() => NavDueno.irANuevoEvento(LocalDate.now(), m.nombre)} />
        </View>
      </View>

      <View style={[estilos.tarjeta, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }]}>
        <Texto tamano={16} negrita>Datos de la mascota</Texto>
        <FilaDato icono="peso" etiqueta="Peso" valor={m.peso} />
        <FilaDato icono="chip" etiqueta="Microchip" valor={m.microchip} />
        <FilaDato icono="gota" etiqueta="Color" valor={m.color} />
        <FilaDato icono="documento" etiqueta="Observaciones" valor={m.observaciones} ultimo />
      </View>

      <Boton titulo="Editar información" icono="editar" alto={54} estilo={{ marginTop: 20 }} onPress={alEditar} />
      <Boton titulo="Cambiar estado: activa, inactiva o fallecida" variante="secundario" alto={52} estilo={{ marginTop: 10 }} onPress={alCambiarEstado} />
      <Boton
        titulo="Dar de baja a la mascota" variante="texto" alto={48} estilo={{ marginTop: 6 }} onPress={alDarDeBaja}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  scroll: { paddingTop: 8, paddingBottom: 28 },
  hero: { borderRadius: 22, alignItems: "center", paddingHorizontal: 18, paddingTop: 22, paddingBottom: 20, overflow: "hidden", ...sombra(2) },
  heroMarca: { position: "absolute", right: -16, bottom: -22, opacity: 0.12, transform: [{ rotate: "-10deg" }] },
  marcoFoto: { width: 116, height: 116, borderRadius: 58, backgroundColor: Colores.white, padding: 3 },
  foto: { width: 110, height: 110, borderRadius: 55, backgroundColor: Colores.lightTeal },
  camara: { position: "absolute", right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", ...sombra(2) },
  tipoRaza: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  estado: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5 },
  estadisticas: { flexDirection: "row", marginTop: 16, marginHorizontal: -5 },
  estadistica: { flex: 1, marginHorizontal: 5, alignItems: "center", padding: 12, backgroundColor: Colores.white, borderRadius: 18, ...sombra(1) },
  cajaIcono: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  tarjeta: { marginTop: 16, backgroundColor: Colores.white, borderRadius: 18, ...sombra(1) },
  saludTitulo: { flexDirection: "row", alignItems: "center" },
  proximo: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  botonesSalud: { flexDirection: "row", gap: 12, marginTop: 14 },
  filaDato: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  divisor: { height: 1, backgroundColor: Colores.dividerLight },
});
