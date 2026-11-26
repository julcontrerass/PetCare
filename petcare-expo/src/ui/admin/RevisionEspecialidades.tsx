/*
 * Títulos de especialidades para revisar, en el inicio del panel del administrador. Cada uno muestra el veterinario
 * (su matrícula y si la cuenta ya está aprobada), la especialidad, el título, la institución, el año y los archivos.
 * Se aprueba (y desde ahí se ofrece a los dueños) o se rechaza con un motivo. Se pide sola al entrar y cada tanto.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BUCKET_HABILITACIONES, extensionDe } from "../../data/habilitaciones";
import type { EspecialidadParaRevisarDto } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { Errores } from "../../util/errores";
import { ArchivosUi } from "../common/ArchivosUi";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Chip } from "../common/Chip";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { DialogoMotivo } from "./DialogoMotivo";

const INTERVALO_MS = 30_000;

function FilaTitulo({ t, ocupado, alAprobar, alRechazar }: {
  t: EspecialidadParaRevisarDto; ocupado: boolean; alAprobar: () => void; alRechazar: () => void;
}) {
  return (
    <Tarjeta relleno={14} estilo={estilos.tarjeta} accessibilityLabel={`${t.especialidad} de ${t.veterinario_nombre} para revisar`}>
      <View style={estilos.cabecera}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="titulo" tamano={15.5}>{t.especialidad}</Texto>
          <Texto variante="subtitulo" tamano={13}>{`${t.veterinario_nombre} · Matrícula ${t.matricula}`}</Texto>
        </View>
        <Chip texto={t.cuenta_aprobada ? "Cuenta aprobada" : "Cuenta en revisión"} tono={t.cuenta_aprobada ? "ok" : "aviso"} />
      </View>
      <View style={estilos.bloque}>
        <Texto variante="chico" tamano={12}>Título</Texto>
        <Texto variante="cuerpo" tamano={14} selectable>{t.titulo}</Texto>
        <Texto variante="chico" tamano={12.5} selectable>{`${t.institucion} · ${t.anio}`}</Texto>
      </View>
      <View style={estilos.archivos}>
        {t.archivos.map((ruta, i) => (
          <Boton
            key={ruta} titulo={t.archivos.length === 1 ? "Ver el título" : `Ver archivo ${i + 1}`} icono="documento"
            variante="secundario" alto={40} onPress={() => void ArchivosUi.abrir(BUCKET_HABILITACIONES, ruta, extensionDe(ruta))}
          />
        ))}
      </View>
      <View style={estilos.botones}>
        <Boton titulo="Rechazar" variante="secundario" alto={44} estilo={{ flex: 1 }} deshabilitado={ocupado} onPress={alRechazar} />
        <Boton titulo="Aprobar" alto={44} estilo={{ flex: 1 }} cargando={ocupado} onPress={alAprobar} />
      </View>
    </Tarjeta>
  );
}

/** [encabezado] dibuja el título de la sección como las demás del panel (solo si hay algo para revisar). */
export function RevisionEspecialidades({ encabezado }: { encabezado: (cantidad: number) => ReactNode }) {
  const [titulos, setTitulos] = useState<EspecialidadParaRevisarDto[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [rechazar, setRechazar] = useState<EspecialidadParaRevisarDto | null>(null);

  const cargar = useCallback(async () => {
    try {
      setTitulos(await Servicios.fuente.especialidadesParaRevisar());
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

  const revisar = async (t: EspecialidadParaRevisarDto, aprobar: boolean, motivo: string | null) => {
    setOcupado(t.id);
    try {
      await Servicios.fuente.revisarEspecialidad(t.id, aprobar, motivo);
      Avisos.mostrar(aprobar ? `${t.especialidad} de ${t.veterinario_nombre} aprobada` : "Título rechazado", aprobar ? "exito" : "info");
      setTitulos((l) => l.filter((x) => x.id !== t.id));
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setOcupado(null);
    }
  };

  if (titulos.length === 0) return null;
  return (
    <View>
      {encabezado(titulos.length)}
      {titulos.map((t) => (
        <FilaTitulo
          key={t.id} t={t} ocupado={ocupado === t.id}
          alAprobar={() => void revisar(t, true, null)} alRechazar={() => setRechazar(t)}
        />
      ))}
      <DialogoMotivo
        pedido={rechazar ? {
          titulo: `Rechazar ${rechazar.especialidad}`,
          ayuda: "El veterinario va a ver este motivo y puede volver a subir el título.",
          sugerencias: ["El archivo no se lee", "El título no corresponde a la especialidad", "No pudimos verificar la institución"],
          confirmar: "Rechazar",
        } : null}
        alConfirmar={(motivo) => {
          const t = rechazar;
          setRechazar(null);
          if (t) void revisar(t, false, motivo);
        }}
        alCancelar={() => setRechazar(null)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 10 },
  cabecera: { flexDirection: "row", alignItems: "center", gap: 10 },
  bloque: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colores.dividerLight },
  archivos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  botones: { flexDirection: "row", gap: 10, marginTop: 12 },
});
