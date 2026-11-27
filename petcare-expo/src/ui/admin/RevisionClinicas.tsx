/*
 * Veterinarias para revisar, en el inicio del panel del administrador. El administrador verifica que existan: el CUIT,
 * el director técnico (si usa PetCare, ya figura como veterinario aprobado; si no, se verifica su matrícula en el
 * Colegio), las habilitaciones comercial y sanitaria, y quién la registró. La aprueba (solo con todo cargado) o la
 * rechaza con un motivo. Se pide sola al entrar y cada tanto, como el resto del panel.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ClinicaAdminDto, ClinicaParaRevisarDto } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { Errores } from "../../util/errores";
import { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { BUCKET_HABILITACIONES, extensionDe } from "../../data/habilitaciones";
import { ArchivosUi } from "../common/ArchivosUi";
import { Boton } from "../common/Boton";
import { Chip } from "../common/Chip";
import { LogoVeterinaria } from "../common/LogoVeterinaria";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { AdminUi, EtiquetaAdmin } from "./AdminUi";
import { DialogoMotivo } from "./DialogoMotivo";

const INTERVALO_MS = 30_000;

/** "30123456789" → "30-12345678-9". */
function cuitLegible(cuit: string): string {
  return cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : cuit;
}

function BotonDocumento({ titulo, ruta }: { titulo: string; ruta: string | null | undefined }) {
  if (!ruta) {
    return (
      <View style={[estilos.documento, estilos.documentoFalta]}>
        <Texto variante="chico" tamano={12.5} color={Colores.dangerRed}>{`${titulo}: falta`}</Texto>
      </View>
    );
  }
  return (
    <Boton
      titulo={`Ver ${titulo.toLowerCase()}`} icono="documento" variante="secundario" alto={40} estilo={{ flex: 1 }}
      onPress={() => void ArchivosUi.abrir(BUCKET_HABILITACIONES, ruta, extensionDe(ruta))}
    />
  );
}

/** Se puede aprobar solo con todo cargado (lo mismo que pide revisar_clinica). */
function clinicaCompleta(c: ClinicaParaRevisarDto): boolean {
  return !!(c.cuit && c.director_matricula && c.habilitacion_comercial_path && c.habilitacion_sanitaria_path);
}

function etiquetaDeEstado(c: ClinicaParaRevisarDto | ClinicaAdminDto): { texto: string; tono: "aviso" | "ok" | "peligro" } {
  const revision = "revision" in c ? c.revision : "pendiente";
  if (revision === "aprobada") return { texto: "Aprobada", tono: "ok" };
  if (revision === "rechazada") return { texto: "Rechazada", tono: "peligro" };
  return { texto: `Registrada ${AdminUi.hace(LocalDate.parse(c.created_at.slice(0, 10))).toLowerCase()}`, tono: "aviso" };
}

function textoEquipo(c: ClinicaAdminDto): string {
  const vets = c.veterinarios === 1 ? "1 veterinario" : `${c.veterinarios} veterinarios`;
  return c.equipo === 1 ? `${vets} · 1 persona en el equipo` : `${vets} · ${c.equipo} personas en el equipo`;
}

/**
 * Tarjeta de una veterinaria con lo que el administrador verifica. Sin [alAprobar] o sin [alRechazar] no dibuja ese
 * botón; [textoRechazar] cambia el del rechazo (p. ej. "Dar de baja" para una ya aprobada).
 */
export function TarjetaClinica({ clinica: c, alAprobar, alRechazar, textoRechazar = "Rechazar", ocupada }: {
  clinica: ClinicaParaRevisarDto | ClinicaAdminDto; alAprobar?: () => void; alRechazar?: () => void; textoRechazar?: string; ocupada: boolean;
}) {
  const estado = etiquetaDeEstado(c);
  const admin = "revision" in c ? c : null;
  const titular = [c.titular_nombre, c.titular_dni ? `DNI ${c.titular_dni}` : null].filter(Boolean).join(" · ");
  const contacto = [c.titular_email, c.titular_telefono].filter(Boolean).join(" · ");
  const completa = clinicaCompleta(c);
  const pendiente = !admin || admin.revision === "pendiente";
  return (
    <Tarjeta relleno={14} estilo={estilos.tarjeta} accessibilityLabel={pendiente ? `Veterinaria ${c.nombre} para revisar` : `Veterinaria ${c.nombre}`}>
      <View style={estilos.fila}>
        <LogoVeterinaria logoPath={c.logo_path} nombre={c.nombre} tamano={52} />
        <View style={estilos.textos}>
          <Texto variante="titulo" tamano={15.5} numberOfLines={1}>{c.nombre}</Texto>
          <Texto variante="subtitulo" tamano={13}>{[c.direccion, c.telefono].filter(Boolean).join(" · ") || "Sin dirección ni teléfono"}</Texto>
          <EtiquetaAdmin texto={estado.texto} tono={estado.tono} estilo={{ marginTop: 6, alignSelf: "flex-start" }} />
        </View>
      </View>
      {admin?.revision === "rechazada" && admin.motivo_revision ? (
        <Texto variante="chico" tamano={12.5} color={Colores.dangerRed} style={{ marginTop: 10 }}>{`Motivo: ${admin.motivo_revision}`}</Texto>
      ) : null}
      {admin && admin.revision === "aprobada" ? (
        <View style={estilos.bloque}>
          <Texto variante="chico" tamano={12}>Equipo</Texto>
          <Texto variante="cuerpo" tamano={14}>{textoEquipo(admin)}</Texto>
        </View>
      ) : null}
      <View style={estilos.bloque}>
        <Texto variante="chico" tamano={12}>CUIT</Texto>
        <Texto variante="cuerpo" tamano={14} selectable>{c.cuit ? cuitLegible(c.cuit) : "Sin cargar"}</Texto>
      </View>
      <View style={estilos.bloque}>
        <Texto variante="chico" tamano={12}>Director técnico</Texto>
        {c.director_matricula ? (
          <>
            <Texto variante="cuerpo" tamano={14} selectable>{`${c.director_nombre ?? ""} · DNI ${c.director_dni ?? "-"}`}</Texto>
            <Texto variante="cuerpo" tamano={14} selectable>{`Matrícula ${c.director_matricula}`}</Texto>
            <Chip
              texto={c.director_en_petcare ? "Veterinario aprobado en PetCare" : "No usa PetCare: verificá la matrícula"}
              tono={c.director_en_petcare ? "ok" : "aviso"} estilo={{ marginTop: 6, alignSelf: "flex-start" }}
            />
          </>
        ) : (
          <Texto variante="cuerpo" tamano={14}>Sin cargar</Texto>
        )}
      </View>
      <View style={estilos.bloque}>
        <Texto variante="chico" tamano={12}>Habilitaciones</Texto>
        <View style={estilos.documentos}>
          <BotonDocumento titulo="Habilitación comercial" ruta={c.habilitacion_comercial_path} />
          <BotonDocumento titulo="Habilitación sanitaria" ruta={c.habilitacion_sanitaria_path} />
        </View>
      </View>
      <View style={estilos.bloque}>
        <Texto variante="chico" tamano={12}>La registró</Texto>
        <Texto variante="cuerpo" tamano={14}>{titular || "Cuenta sin datos"}</Texto>
        {contacto ? <Texto variante="chico" tamano={12.5}>{contacto}</Texto> : null}
      </View>
      {completa || !pendiente ? null : (
        <Texto variante="chico" tamano={12.5} color={Colores.accentOrangeDark} style={{ marginTop: 10 }}>
          Falta documentación: se carga cuando el titular ingresa a la app. Hasta entonces no se puede aprobar.
        </Texto>
      )}
      {alRechazar || alAprobar ? (
        <View style={estilos.botones}>
          {alRechazar ? (
            <Boton titulo={textoRechazar} variante="secundario" alto={44} estilo={{ flex: 1 }} deshabilitado={ocupada} cargando={ocupada && !alAprobar} onPress={alRechazar} />
          ) : null}
          {alAprobar ? <Boton titulo="Aprobar" alto={44} estilo={{ flex: 1 }} cargando={ocupada} deshabilitado={!completa} onPress={alAprobar} /> : null}
        </View>
      ) : null}
    </Tarjeta>
  );
}

/**
 * [encabezado] dibuja el título de la sección como las demás del panel (solo si hay algo para revisar); [alRevisar]
 * avisa que se aprobó o rechazó una (para actualizar la sección Veterinarias).
 */
export function RevisionClinicas({ encabezado, alRevisar }: { encabezado: (cantidad: number) => ReactNode; alRevisar?: () => void }) {
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
      alRevisar?.();
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
        <TarjetaClinica
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
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  bloque: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colores.dividerLight },
  documentos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  documento: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  documentoFalta: { backgroundColor: Colores.lightRed },
  botones: { flexDirection: "row", gap: 10, marginTop: 12 },
});
