/*
 * Migrado de ui/dueno/HomePantalla.kt + pantalla_home.xml + item_home_mascota.xml + item_home_evento.xml.
 * Inicio: resumen del próximo turno, accesos rápidos, mascotas, recordatorios y actividad reciente.
 */
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { Mascota } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Avatar } from "../common/Avatar";
import { ChipEstadoMascota, diasHasta, EstadoVacio } from "../common/ComponentesDueno";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Insignia } from "../common/Insignia";
import { PantallaBase } from "../common/PantallaBase";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { Grilla } from "../common/Grilla";
import { cursorTocable, estiloFoco, useEscritorio, useFoco } from "../common/Web";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { FilaEvento, FotoVetEvento, iconoDeTipo, TituloSeccion } from "./ComponentesHome";
import { InvitacionesCodueno } from "./InvitacionesCodueno";
import { InvitacionesRecepcion } from "./InvitacionesRecepcion";
import { MedicamentosActivos } from "./MedicamentosActivos";
import { RemediosDeHoy } from "./RemediosDeHoy";
import { NavDueno } from "./navegacionDueno";

function Acceso({ icono, color, texto, alTocar }: { icono: NombreIcono; color: string; texto: string; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar} {...foco.props} style={[estilos.acceso, cursorTocable, estiloFoco(foco.enfocado)]}>
      <View style={estilos.accesoCaja}>
        <Icono nombre={icono} tamano={26} color={color} />
      </View>
      <Texto tamano={11.5} peso="medium" color={Colores.tealDark} centrado numberOfLines={2}>{texto}</Texto>
    </Pressable>
  );
}

function TarjetaMascota({ mascota }: { mascota: Mascota }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${mascota.nombre}, ${mascota.raza || mascota.tipo}`}
      onPress={() => NavDueno.irADetalleMascota(mascota)} {...foco.props}
      style={[estilos.tarjetaMascota, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <ImagenRemota
        fotoUri={mascota.fotoUri} fotoPath={mascota.fotoPath}
        estilo={estilos.fotoMascota}
        respaldo={<Icono nombre={iconoDeTipo(mascota.tipo)} tamano={48} color={Colores.primaryTeal} />}
      />
      <Texto tamano={14} negrita numberOfLines={1} style={{ marginTop: 7 }}>{mascota.nombre}</Texto>
      <Texto variante="chico" tamano={11.5} numberOfLines={1}>{mascota.raza || mascota.tipo}</Texto>
      <View style={{ marginTop: 5 }}>
        <ChipEstadoMascota nombreMascota={mascota.nombre} />
      </View>
    </Pressable>
  );
}

function TarjetaPrincipal() {
  const proximo = DuenoRepo.eventosOrdenados(true)[0] ?? null;
  let etiqueta = "Todo en orden";
  let titulo = "Sin eventos próximos";
  let subtitulo = "Agendá un control o una vacuna para no olvidarte de nada.";
  let accion = "+ Agendar evento";
  let alAccion = () => NavDueno.irANuevoEvento(LocalDate.now());
  if (proximo) {
    const dias = diasHasta(proximo.fecha);
    const cuando = dias <= 0 ? "Hoy" : dias === 1 ? "Mañana" : `${proximo.fecha.dayOfMonth} ${Fechas.mesCorto(proximo.fecha.monthValue)}`;
    etiqueta = "Próximo evento";
    titulo = proximo.categoria;
    subtitulo =
      (proximo.mascota ? `${proximo.mascota} · ` : "") + `${cuando}, ${proximo.hora}` +
      (proximo.veterinario ? ` · ${proximo.veterinario}` : "");
    accion = "Ver detalle";
    alAccion = () => NavDueno.irARecordatorios();
  }
  const tieneVet = proximo?.veterinarioId != null && DuenoRepo.perfilDeVeterinario(proximo.veterinarioId)?.foto_path;
  return (
    <LinearGradient colors={[Colores.primaryTeal, "#17A58F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
      <View style={estilos.heroMarca} pointerEvents="none">
        <Icono nombre="perro" tamano={150} color={Colores.white} />
      </View>
      <View style={estilos.heroIcono}>
        {tieneVet ? <FotoVetEvento veterinarioId={proximo?.veterinarioId} tamano={46} /> : (
          <Icono nombre={proximo ? "calendario" : "check"} tamano={26} color={Colores.white} />
        )}
      </View>
      <Texto tamano={12} negrita color="rgba(255,255,255,0.85)" style={estilos.heroEtiqueta}>{etiqueta.toUpperCase()}</Texto>
      <Texto tamano={21} negrita color={Colores.white} style={{ marginTop: 4, marginRight: 60 }}>{titulo}</Texto>
      <Texto tamano={13} color="rgba(255,255,255,0.92)" style={{ marginTop: 3, marginRight: 40 }}>{subtitulo}</Texto>
      <Pressable accessibilityRole="button" accessibilityLabel={accion} onPress={alAccion} style={[estilos.heroBoton, cursorTocable]}>
        <Texto tamano={13} negrita color={Colores.primaryTeal}>{accion}</Texto>
      </Pressable>
    </LinearGradient>
  );
}

export default function HomePantalla() {
  useSesionRequerida();
  useDatos();
  const perfil = DuenoRepo.perfil;
  const hoy = LocalDate.now();
  const mascotas = DuenoRepo.mascotasActivas;
  const proximos = DuenoRepo.eventosOrdenados(true).slice(0, 3);
  const reciente = DuenoRepo.actividadReciente().slice(0, 5);
  const focoAgregar = useFoco();
  const escritorio = useEscritorio();

  return (
    <PantallaBase bordes={["top"]} estiloContenido={estilos.contenido}>
      <View style={estilos.encabezado}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto tamano={26} negrita color={Colores.brandNavy} accessibilityRole="header">
            {perfil.nombre.trim() ? `Hola, ${perfil.primerNombre}` : "Hola"}
          </Texto>
          <Texto variante="chico" tamano={13} style={{ marginTop: 2, marginRight: 8 }}>
            {`${Fechas.diaSemana(hoy)} ${hoy.dayOfMonth} de ${Fechas.nombreMes(hoy.monthValue).toLowerCase()} · ¿Cómo están tus mascotas?`}
          </Texto>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notificaciones" onPress={() => NavDueno.mostrarNotificaciones()} style={[estilos.campana, cursorTocable]}>
          <Icono nombre="notificacion" tamano={22} color={Colores.brandNavy} />
          <Insignia cantidad={DuenoRepo.notificacionesSinLeer} estilo={estilos.insignia} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Mi perfil" onPress={() => NavDueno.irAPerfil()} style={cursorTocable}>
          <Avatar fotoUri={perfil.fotoUri} fotoPath={perfil.fotoPath} tamano={42} estilo={estilos.avatar} />
        </Pressable>
      </View>

      <InvitacionesCodueno />
      <InvitacionesRecepcion />

      <TarjetaPrincipal />

      <RemediosDeHoy />
      <MedicamentosActivos />

      <View style={estilos.accesos}>
        <Acceso icono="calendarioMas" color={Colores.primaryTeal} texto="Nuevo evento" alTocar={() => NavDueno.irANuevoEvento(LocalDate.now())} />
        <Acceso icono="historial" color={Colores.accentPurple} texto="Historial" alTocar={() => NavDueno.irAMascotas()} />
        <Acceso icono="botiquin" color={Colores.successGreen} texto="Veterinarios" alTocar={() => NavDueno.irAVeterinarios()} />
        <Acceso icono="documento" color={Colores.accentOrange} texto="Documentos" alTocar={() => NavDueno.abrirCarnet()} />
      </View>

      <TituloSeccion titulo="Mis mascotas" accion="Ver todas" alAccion={() => NavDueno.irAMascotas()} estilo={{ marginTop: 22 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.fila} contentContainerStyle={estilos.filaContenido}>
        {mascotas.map((m) => <TarjetaMascota key={m.id} mascota={m} />)}
        <Pressable
          accessibilityRole="button" accessibilityLabel="Nueva mascota" onPress={() => NavDueno.irANuevaMascota()} {...focoAgregar.props}
          style={[estilos.agregar, cursorTocable, estiloFoco(focoAgregar.enfocado)]}
        >
          <View style={estilos.agregarCirculo}>
            <Icono nombre="mas" tamano={22} color={Colores.primaryTeal} />
          </View>
          <Texto tamano={12} negrita color={Colores.primaryTeal} style={{ marginTop: 6 }}>Nueva</Texto>
        </Pressable>
      </ScrollView>

      <Grilla columnas={2}>
      <View>
      <TituloSeccion titulo="Próximos recordatorios" accion="Ver todas" alAccion={() => NavDueno.irARecordatorios()} estilo={{ marginTop: 16 }} />
      <View style={{ marginTop: 2 }}>
        {proximos.map((e) => {
          const dias = diasHasta(e.fecha);
          const cercano = dias <= 1;
          return (
            <FilaEvento
              key={e.id} evento={e}
              subtitulo={`${e.mascota} · ${e.fecha.dayOfMonth} ${Fechas.mesCorto(e.fecha.monthValue)} · ${e.hora}`}
              chip={{
                texto: dias <= 0 ? "Hoy" : dias === 1 ? "Mañana" : `En ${dias} días`,
                fondo: cercano ? Colores.lightOrange : Colores.lightGreen,
                color: cercano ? Colores.accentOrangeDark : Colores.successGreen,
              }}
              onPress={() => NavDueno.irARecordatorios()}
            />
          );
        })}
        {proximos.length === 0 ? (
          <EstadoVacio
            icono="notificacion" titulo="No hay próximos recordatorios" mensaje="Creá uno para no olvidarte de vacunas y controles"
            textoBoton="+ Crear recordatorio" alBoton={() => NavDueno.irANuevoEvento(LocalDate.now())}
          />
        ) : null}
      </View>
      </View>

      <View>
      <TituloSeccion titulo="Actividad reciente" accion="Ver historial" alAccion={() => NavDueno.irAMascotas()} estilo={{ marginTop: escritorio ? 16 : 18 }} />
      <View style={{ marginTop: 2, marginBottom: 12 }}>
        {reciente.map((e) => (
          <FilaEvento
            key={e.id} evento={e} chevron
            subtitulo={`${e.mascota} · ${e.fecha.dayOfMonth} ${Fechas.mesCorto(e.fecha.monthValue)}${e.veterinario ? ` · ${e.veterinario}` : ""}`}
            onPress={() => {
              const m = DuenoRepo.buscarMascota(e.mascota);
              if (m) NavDueno.irADetalleMascota(m);
              else NavDueno.irAMascotas();
            }}
          />
        ))}
        {reciente.length === 0 ? (
          <EstadoVacio icono="historial" titulo="Sin actividad en los últimos 30 días" mensaje="Acá vas a ver consultas, vacunas y tratamientos" />
        ) : null}
      </View>
      </View>
      </Grilla>
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  contenido: { paddingTop: 20 },
  encabezado: { flexDirection: "row", alignItems: "center" },
  campana: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", marginRight: 12, ...sombra(1) },
  insignia: { position: "absolute", top: -4, right: -4 },
  avatar: { borderWidth: 2, borderColor: Colores.white },
  hero: { marginTop: 16, borderRadius: 22, padding: 18, overflow: "hidden", ...sombra(2) },
  heroMarca: { position: "absolute", right: -16, bottom: -24, opacity: 0.13, transform: [{ rotate: "-10deg" }] },
  heroIcono: { position: "absolute", top: 18, right: 18, width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroEtiqueta: { letterSpacing: 0.7 },
  heroBoton: { marginTop: 14, alignSelf: "flex-start", backgroundColor: Colores.white, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 9 },
  accesos: { flexDirection: "row", marginTop: 16 },
  acceso: { flex: 1, marginHorizontal: 5, alignItems: "center" },
  accesoCaja: { width: "100%", height: 56, borderRadius: 18, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", marginBottom: 6, ...sombra(1) },
  // flexGrow 0: en la web el ScrollView horizontal crece para llenar el alto sobrante
  fila: { marginHorizontal: -20, flexGrow: 0 },
  filaContenido: { paddingHorizontal: 20, paddingVertical: 6, alignItems: "stretch" },
  tarjetaMascota: { width: 128, marginRight: 12, padding: 8, backgroundColor: Colores.white, borderRadius: 18, ...sombra(1) },
  fotoMascota: { width: "100%", height: 96, borderRadius: 12, backgroundColor: Colores.lightTeal },
  agregar: {
    width: 100, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: "#9FC7C2", backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center", justifyContent: "center", paddingVertical: 16,
  },
  agregarCirculo: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
});
