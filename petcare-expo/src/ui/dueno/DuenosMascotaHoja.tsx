/*
 * Dueños de una mascota: el original, los co-dueños y las invitaciones sin responder. Cualquier dueño invita a otra
 * cuenta por DNI o correo; el original quita co-dueños y cancela invitaciones; un co-dueño puede salir.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CuentaActual } from "../../data/cuentaActual";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { DuenoMascotaDto } from "../../data/remoto/dtos";
import type { Mascota } from "../../model/modelos";
import { Errores } from "../../util/errores";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { Chip } from "../common/Chip";
import { HojaInferior } from "../common/HojaInferior";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

function AccionFila({ texto, alTocar }: { texto: string; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar} hitSlop={8} {...foco.props}
      style={[estilos.accion, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto tamano={13} negrita color={Colores.dangerRed}>{texto}</Texto>
    </Pressable>
  );
}

function FilaDueno({ dueno, accion }: { dueno: DuenoMascotaDto; accion: { texto: string; alTocar: () => void } | null }) {
  const yo = dueno.usuario_id === CuentaActual.usuarioId;
  return (
    <View style={estilos.fila}>
      <Avatar nombre={dueno.nombre} fotoPath={dueno.foto_path ?? null} tamano={42} />
      <View style={estilos.textos}>
        <Texto tamano={15} negrita numberOfLines={1}>{yo ? `${dueno.nombre} (vos)` : dueno.nombre}</Texto>
        <Texto variante="chico" tamano={12} numberOfLines={1}>{dueno.email}</Texto>
        <View style={estilos.chips}>
          {dueno.es_original ? <Chip texto="Dueño original" tono="info" /> : null}
          {dueno.estado === "pendiente" ? <Chip texto="Invitación pendiente" tono="aviso" /> : null}
        </View>
      </View>
      {accion ? <AccionFila texto={accion.texto} alTocar={accion.alTocar} /> : null}
    </View>
  );
}

export function DuenosMascotaHoja({ mascota, alCerrar, alSalir }: { mascota: Mascota; alCerrar: () => void; alSalir: () => void }) {
  const [duenos, setDuenos] = useState<DuenoMascotaDto[] | null>(null);
  const [dato, setDato] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const soyOriginal = !mascota.compartida;

  const cargar = useCallback(async () => {
    try {
      setDuenos(await DuenoRepo.duenosDe(mascota));
    } catch (e) {
      setDuenos([]);
      Avisos.error(Errores.mensaje(e));
    }
  }, [mascota]);

  useEffect(() => { void cargar(); }, [cargar]);

  const invitar = async () => {
    const texto = dato.trim();
    if (texto.length < 6) {
      setError("Ingresá el DNI o el correo de la otra persona");
      return;
    }
    setEnviando(true);
    try {
      const nombre = await DuenoRepo.invitarCodueno(mascota, texto);
      setDato("");
      Avisos.exito(`Le mandamos la invitación a ${nombre}`);
      await cargar();
    } catch (e) {
      setError(Errores.mensaje(e));
    } finally {
      setEnviando(false);
    }
  };

  const quitar = (d: DuenoMascotaDto) => {
    const pendiente = d.estado === "pendiente";
    Avisos.confirmar({
      titulo: pendiente ? "¿Cancelar la invitación?" : `¿Quitar a ${d.nombre}?`,
      mensaje: pendiente
        ? `${d.nombre} ya no va a poder sumarse como dueño/a de ${mascota.nombre}.`
        : `${d.nombre} deja de ver a ${mascota.nombre} y su historial. Podés volver a invitarlo/a cuando quieras.`,
      textoAceptar: pendiente ? "Cancelar invitación" : "Quitar", textoCancelar: "Volver",
      alAceptar: () => {
        void (async () => {
          try {
            await DuenoRepo.quitarCodueno(d.codueno_id!);
            await cargar();
          } catch (e) {
            Avisos.error(Errores.mensaje(e));
          }
        })();
      },
    });
  };

  const salir = (d: DuenoMascotaDto) => {
    Avisos.confirmar({
      titulo: `¿Dejar de ser dueño/a de ${mascota.nombre}?`,
      mensaje: "Vas a dejar de verla en tus mascotas. Los demás dueños la siguen teniendo y te pueden volver a invitar.",
      textoAceptar: "Dejar de ser dueño", textoCancelar: "Volver", icono: "salir",
      alAceptar: () => {
        void (async () => {
          try {
            await DuenoRepo.dejarDeSerDueno(mascota, d.codueno_id!);
            Avisos.mostrar(`Ya no sos dueño/a de ${mascota.nombre}`);
            alSalir();
          } catch (e) {
            Avisos.error(Errores.mensaje(e));
          }
        })();
      },
    });
  };

  const accionDe = (d: DuenoMascotaDto) => {
    if (d.es_original || d.codueno_id == null) return null;
    if (d.usuario_id === CuentaActual.usuarioId) return { texto: "Salir", alTocar: () => salir(d) };
    if (soyOriginal) return { texto: d.estado === "pendiente" ? "Cancelar" : "Quitar", alTocar: () => quitar(d) };
    return null;
  };

  return (
    <HojaInferior
      visible alCerrar={alCerrar}
      pie={<Boton titulo="Enviar invitación" icono="persona" alto={50} cargando={enviando} onPress={() => void invitar()} />}
    >
      <Texto tamano={20} negrita accessibilityRole="header">{`Dueños de ${mascota.nombre}`}</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        Los dueños ven la misma ficha, el historial y los turnos, y pueden cargar datos. Solo el dueño original puede
        eliminar la mascota y quitar a otros dueños.
      </Texto>

      <View style={{ marginTop: 12 }}>
        {duenos == null ? (
          <ActivityIndicator color={Colores.primaryTeal} style={{ marginVertical: 16 }} />
        ) : (
          duenos.map((d) => <FilaDueno key={d.codueno_id ?? d.usuario_id} dueno={d} accion={accionDe(d)} />)
        )}
      </View>

      <Texto tamano={15} negrita style={{ marginTop: 16 }}>Invitar a otro dueño</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>
        Tiene que tener una cuenta en PetCare. Le llega una invitación para aceptar.
      </Texto>
      <Campo
        icono="persona" placeholder="DNI o correo" accessibilityLabel="DNI o correo de la persona a invitar"
        value={dato} onChangeText={(t) => { setDato(t); setError(null); }} error={error}
        autoCapitalize="none" keyboardType="email-address" returnKeyType="send" onSubmitEditing={() => void invitar()}
        estilo={{ marginTop: 10 }}
      />
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  accion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
});
