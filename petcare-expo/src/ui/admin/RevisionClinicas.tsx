/*
 * Veterinarias para revisar, en el inicio del panel del administrador: las que registró alguien que no es veterinario
 * (el dueño del negocio). El administrador verifica que existan (nombre, dirección, teléfono y quién la registró) y
 * la aprueba o la rechaza con un motivo. Se pide sola al entrar y cada tanto, como el resto del panel.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ClinicaParaRevisarDto } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { Errores } from "../../util/errores";
import { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { AdminUi, EtiquetaAdmin } from "./AdminUi";
import { DialogoMotivo } from "./DialogoMotivo";

const INTERVALO_MS = 30_000;

function FilaClinica({ clinica: c, alAprobar, alRechazar, ocupada }: {
  clinica: ClinicaParaRevisarDto; alAprobar: () => void; alRechazar: () => void; ocupada: boolean;
}) {
  const titular = [c.titular_nombre, c.titular_dni ? `DNI ${c.titular_dni}` : null].filter(Boolean).join(" · ");
  const contacto = [c.titular_email, c.titular_telefono].filter(Boolean).join(" · ");
  return (
    <Tarjeta relleno={14} estilo={estilos.tarjeta} accessibilityLabel={`Veterinaria ${c.nombre} para revisar`}>
      <View style={estilos.fila}>
        <View style={estilos.icono}><Icono nombre="sede" tamano={22} color={Colores.primaryTeal} /></View>
        <View style={estilos.textos}>
          <Texto variante="titulo" tamano={15.5} numberOfLines={1}>{c.nombre}</Texto>
          <Texto variante="subtitulo" tamano={13}>{[c.direccion, c.telefono].filter(Boolean).join(" · ") || "Sin dirección ni teléfono"}</Texto>
          <EtiquetaAdmin
            texto={`Registrada ${AdminUi.hace(LocalDate.parse(c.created_at.slice(0, 10))).toLowerCase()}`}
            tono="aviso" estilo={{ marginTop: 6, alignSelf: "flex-start" }}
          />
        </View>
      </View>
      <View style={estilos.titular}>
        <Texto variante="chico" tamano={12}>La registró</Texto>
        <Texto variante="cuerpo" tamano={14}>{titular || "Cuenta sin datos"}</Texto>
        {contacto ? <Texto variante="chico" tamano={12.5}>{contacto}</Texto> : null}
      </View>
      <View style={estilos.botones}>
        <Boton titulo="Rechazar" variante="secundario" alto={44} estilo={{ flex: 1 }} deshabilitado={ocupada} onPress={alRechazar} />
        <Boton titulo="Aprobar" alto={44} estilo={{ flex: 1 }} cargando={ocupada} onPress={alAprobar} />
      </View>
    </Tarjeta>
  );
}

/** [encabezado] dibuja el título de la sección como las demás del panel (solo si hay algo para revisar). */
export function RevisionClinicas({ encabezado }: { encabezado: (cantidad: number) => ReactNode }) {
  const [clinicas, setClinicas] = useState<ClinicaParaRevisarDto[]>([]);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [rechazar, setRechazar] = useState<ClinicaParaRevisarDto | null>(null);

  const cargar = useCallback(async () => {
    try {
      setClinicas(await Servicios.fuente.clinicasParaRevisar());
    } catch {
      // se reintenta en la próxima vuelta
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      const t = setInterval(() => void cargar(), INTERVALO_MS);
      return () => clearInterval(t);
    }, [cargar]),
  );

  const revisar = async (c: ClinicaParaRevisarDto, aprobar: boolean, motivo: string | null) => {
    setOcupada(c.id);
    try {
      await Servicios.fuente.revisarClinica(c.id, aprobar, motivo);
      Avisos.mostrar(aprobar ? `${c.nombre} ya está dada de alta` : `Rechazaste ${c.nombre}`, aprobar ? "exito" : "info");
      setClinicas((lista) => lista.filter((x) => x.id !== c.id));
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setOcupada(null);
    }
  };

  if (clinicas.length === 0) return null;
  return (
    <View>
      {encabezado(clinicas.length)}
      {clinicas.map((c) => (
        <FilaClinica
          key={c.id} clinica={c} ocupada={ocupada === c.id}
          alAprobar={() => void revisar(c, true, null)} alRechazar={() => setRechazar(c)}
        />
      ))}
      <DialogoMotivo
        pedido={rechazar ? {
          titulo: `Rechazar ${rechazar.nombre}`,
          ayuda: "Quien la registró va a ver este motivo.",
          sugerencias: ["No pudimos verificar que exista", "La dirección o el teléfono no coinciden", "Datos incompletos"],
          confirmar: "Rechazar",
        } : null}
        alConfirmar={(motivo) => {
          const c = rechazar;
          setRechazar(null);
          if (c) void revisar(c, false, motivo);
        }}
        alCancelar={() => setRechazar(null)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 10 },
  fila: { flexDirection: "row", alignItems: "center" },
  icono: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  titular: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colores.dividerLight },
  botones: { flexDirection: "row", gap: 10, marginTop: 12 },
});
