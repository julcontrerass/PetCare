/*
 * Migrado de ui/dueno/DetalleMascotaPantalla.kt + pantalla_mascota.xml: ficha de una mascota con las pestañas
 * Información, Historial y Recordatorios. La ruta `/dueno/mascota/[id]` le pasa la mascota.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { EstadosMascota, type EstadoMascota, type Mascota } from "../../model/modelos";
import { Avisos } from "../common/Avisos";
import { BotonIcono } from "../common/BotonIcono";
import { HojaInferior } from "../common/HojaInferior";
import { Icono, type NombreIcono } from "../common/Icono";
import { PantallaBase } from "../common/PantallaBase";
import { elegirImagen } from "../common/Selectores";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { BajaMascotaDialogo, CambiarEstadoHoja, EditarMascotaHoja } from "./DialogosMascota";
import { EstadoDueno } from "./estadoDueno";
import { HistorialMascota } from "./HistorialMascota";
import { InfoMascota } from "./InfoMascota";
import { NavDueno } from "./navegacionDueno";
import { RecordatoriosContenido } from "./RecordatoriosContenido";

const PESTANAS = ["Información", "Historial", "Recordatorios"] as const;

function Pestana({ texto, activa, alTocar }: { texto: string; activa: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="tab" accessibilityLabel={texto} accessibilityState={{ selected: activa }} onPress={alTocar} {...foco.props}
      style={[estilos.pestana, activa ? estilos.pestanaActiva : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto tamano={13} negrita color={activa ? Colores.primaryTeal : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

function FilaOpcion({ icono, texto, color, alTocar }: { icono: NombreIcono; texto: string; color?: string; alTocar: () => void }) {
  return (
    <Pressable accessibilityRole="menuitem" accessibilityLabel={texto} onPress={alTocar} style={[estilos.opcion, cursorTocable]}>
      <Icono nombre={icono} tamano={22} color={color ?? Colores.primaryTeal} />
      <Texto tamano={15} peso="medium" color={color ?? Colores.brandNavy} style={{ marginLeft: 14 }}>{texto}</Texto>
    </Pressable>
  );
}

type Dialogo = "menu" | "editar" | "estado" | "baja" | null;

export function DetalleMascotaPantalla({ mascota }: { mascota: Mascota }) {
  useSesionRequerida();
  useDatos();
  const [pestana, setPestana] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [, redibujar] = useState(0);
  const refrescar = () => redibujar((n) => n + 1);
  const m = mascota;

  const elegirFoto = async () => {
    const uri = await elegirImagen();
    if (uri) {
      DuenoRepo.cambiarFotoMascota(m, uri);
      refrescar();
    }
  };
  const aplicarEstado = (mm: Mascota, nuevo: EstadoMascota) => {
    DuenoRepo.cambiarEstadoMascota(mm, nuevo);
    refrescar();
    Avisos.mostrar(`${mm.nombre} ahora está ${EstadosMascota[nuevo].etiqueta.toLowerCase()}`);
  };
  const darDeBaja = (mm: Mascota, motivo: string) => {
    DuenoRepo.darDeBajaMascota(mm, motivo);
    EstadoDueno.mascotaActual = null;
    setDialogo(null);
    Avisos.mostrar("Mascota dada de baja correctamente");
    NavDueno.irAMascotas();
  };
  const elegirOpcion = (siguiente: () => void) => { setDialogo(null); siguiente(); };

  return (
    <PantallaBase
      bordes={["top"]} scroll={false} titulo={m.nombre} alVolver={() => NavDueno.irAMascotas()}
      derecha={<BotonIcono icono="masOpciones" accessibilityLabel="Más opciones" fondo="ninguno" onPress={() => setDialogo("menu")} />}
    >
      <View style={estilos.pestanas} accessibilityRole="tablist">
        {PESTANAS.map((p, i) => <Pestana key={p} texto={p} activa={i === pestana} alTocar={() => setPestana(i)} />)}
      </View>
      <View style={{ flex: 1 }}>
        {pestana === 0 ? (
          <InfoMascota
            mascota={m} alCambiarFoto={elegirFoto} alEditar={() => setDialogo("editar")}
            alCambiarEstado={() => setDialogo("estado")} alDarDeBaja={() => setDialogo("baja")}
          />
        ) : pestana === 1 ? (
          <HistorialMascota mascota={m} />
        ) : (
          <RecordatoriosContenido global={false} mascota={m.nombre} />
        )}
      </View>

      {dialogo === "menu" ? (
        <HojaInferior visible alCerrar={() => setDialogo(null)}>
          <FilaOpcion icono="editar" texto="Editar información" alTocar={() => elegirOpcion(() => setDialogo("editar"))} />
          <FilaOpcion icono="camara" texto="Cambiar foto" alTocar={() => elegirOpcion(() => { void elegirFoto(); })} />
          <FilaOpcion icono="calendarioMas" texto="Agendar turno" alTocar={() => elegirOpcion(() => NavDueno.irANuevoEvento(EstadoDueno.diaSeleccionado, m.nombre))} />
          <FilaOpcion icono="mascotas" texto="Cambiar estado" alTocar={() => elegirOpcion(() => setDialogo("estado"))} />
          <FilaOpcion icono="borrar" texto="Eliminar mascota" color={Colores.dangerRed} alTocar={() => elegirOpcion(() => setDialogo("baja"))} />
        </HojaInferior>
      ) : null}
      {dialogo === "editar" ? <EditarMascotaHoja mascota={m} alCerrar={() => setDialogo(null)} alGuardar={refrescar} /> : null}
      {dialogo === "estado" ? <CambiarEstadoHoja mascota={m} alCerrar={() => setDialogo(null)} alAplicar={aplicarEstado} /> : null}
      {dialogo === "baja" ? <BajaMascotaDialogo mascota={m} alCerrar={() => setDialogo(null)} alConfirmar={darDeBaja} /> : null}
    </PantallaBase>
  );
}

export default DetalleMascotaPantalla;

const estilos = StyleSheet.create({
  pestanas: { flexDirection: "row", gap: 12, marginTop: 8 },
  pestana: { flex: 1, height: 48, borderRadius: 12, backgroundColor: Colores.lightGray, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  pestanaActiva: { backgroundColor: Colores.lightTeal, borderColor: Colores.primaryTeal },
  opcion: { flexDirection: "row", alignItems: "center", minHeight: 52 },
});
