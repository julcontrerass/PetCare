/*
 * Sección "Veterinarias" del panel del administrador: todas las veterinarias, en revisión, aprobadas o rechazadas, con
 * lo que se verifica de cada una (CUIT, director técnico, habilitaciones, quién la registró) y cuánta gente tienen.
 * Desde acá se aprueba o rechaza una en revisión, se da de baja una aprobada o se aprueba una rechazada que ya
 * completó todo. Usa la misma revisión que el inicio (revisar_clinica).
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactElement, type ReactNode } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import type { ClinicaAdminDto, RevisionClinica } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { EstadoVacio } from "../common/EstadoVacio";
import { Texto } from "../common/Texto";
import { AdminUi } from "./AdminUi";
import { DialogoMotivo, type PedidoMotivo } from "./DialogoMotivo";
import { BuscadorAdmin, FiltrosAdmin } from "./FiltrosAdmin";
import { TarjetaClinica } from "./RevisionClinicas";

const INTERVALO_MS = 30_000;

const FILTROS: { estado: RevisionClinica | null; texto: string }[] = [
  { estado: "pendiente", texto: "En revisión" },
  { estado: "aprobada", texto: "Aprobadas" },
  { estado: "rechazada", texto: "Rechazadas" },
  { estado: null, texto: "Todas" },
];

/** Todas las veterinarias para el administrador; se piden al entrar y cada tanto. */
export function useClinicasAdmin(): { clinicas: ClinicaAdminDto[]; recargar: () => Promise<void> } {
  const [clinicas, setClinicas] = useState<ClinicaAdminDto[]>([]);
  const recargar = useCallback(async () => {
    try {
      setClinicas(await Servicios.fuente.clinicasAdmin());
    } catch {
      // se reintenta en la próxima vuelta
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void recargar();
      const t = setInterval(() => void recargar(), INTERVALO_MS);
      return () => clearInterval(t);
    }, [recargar]),
  );
  return { clinicas, recargar };
}

interface PanelVeterinariasProps {
  clinicas: ClinicaAdminDto[];
  recargar: () => Promise<void>;
  /** Columnas de la lista (2 en pantallas anchas) y cómo envolver cada tarjeta para ese ancho. */
  columnas: number;
  envolver: (hijo: ReactNode, id: string, margenAbajo: number) => ReactElement;
  estiloPanel: object;
}

export function PanelVeterinarias({ clinicas, recargar, columnas, envolver, estiloPanel }: PanelVeterinariasProps) {
  const [filtro, setFiltro] = useState<string | null>("pendiente");
  const [busqueda, setBusqueda] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [rechazar, setRechazar] = useState<ClinicaAdminDto | null>(null);

  const revisar = async (c: ClinicaAdminDto, aprobar: boolean, motivo: string | null) => {
    setOcupada(c.id);
    try {
      await Servicios.fuente.revisarClinica(c.id, aprobar, motivo);
      const mensaje = aprobar
        ? `${c.nombre} ya está dada de alta`
        : c.revision === "aprobada" ? `Diste de baja ${c.nombre}` : `Rechazaste ${c.nombre}`;
      Avisos.mostrar(mensaje, aprobar ? "exito" : "info");
      await recargar();
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setOcupada(null);
    }
  };

  const lista = clinicas
    .filter((c) => filtro == null || c.revision === filtro)
    .filter((c) => AdminUi.textoContiene(busqueda, c.nombre, c.direccion ?? "", c.cuit ?? "", c.titular_nombre ?? "", c.titular_email ?? "", c.director_nombre ?? ""));
  const cuantas = (estado: string | null) => (estado == null ? clinicas.length : clinicas.filter((c) => c.revision === estado).length);
  const aprobadas = cuantas("aprobada");
  const enRevision = cuantas("pendiente");
  const buscando = busqueda.trim() !== "";

  let pedido: PedidoMotivo | null = null;
  if (rechazar?.revision === "aprobada") {
    pedido = {
      titulo: `Dar de baja ${rechazar.nombre}`,
      ayuda: "Su equipo deja de poder trabajar como veterinaria hasta que la vuelvas a aprobar. El titular va a ver este motivo.",
      sugerencias: ["Habilitación vencida", "Cerró la veterinaria", "Reclamos de dueños"],
      confirmar: "Dar de baja",
    };
  } else if (rechazar) {
    pedido = {
      titulo: `Rechazar ${rechazar.nombre}`,
      ayuda: "Quien la registró va a ver este motivo.",
      sugerencias: ["No pudimos verificar que exista", "La dirección o el teléfono no coinciden", "Datos incompletos"],
      confirmar: "Rechazar",
    };
  }

  const tarjeta = (c: ClinicaAdminDto) => {
    const pendiente = c.revision === "pendiente";
    const aprobada = c.revision === "aprobada";
    return (
      <TarjetaClinica
        clinica={c}
        ocupada={ocupada === c.id}
        alAprobar={aprobada ? undefined : () => void revisar(c, true, null)}
        alRechazar={pendiente || aprobada ? () => setRechazar(c) : undefined}
        textoRechazar={aprobada ? "Dar de baja" : "Rechazar"}
      />
    );
  };

  return (
    <View style={estiloPanel}>
      <Texto variante="titulo" tamano={26}>Veterinarias</Texto>
      <Texto variante="subtitulo" tamano={13}>{`${aprobadas} aprobadas · ${enRevision} en revisión`}</Texto>
      <BuscadorAdmin placeholder="Buscar por nombre, CUIT, dirección o titular..." valor={busqueda} alCambiar={setBusqueda} />
      <FiltrosAdmin opciones={FILTROS} elegido={filtro} alElegir={setFiltro} cantidad={cuantas} />
      {lista.length === 0 ? (
        <EstadoVacio
          icono="sede"
          titulo={buscando ? "No encontramos veterinarias" : "Sin veterinarias acá"}
          mensaje={buscando ? "Probá con otro nombre, CUIT o titular" : "No hay veterinarias con este estado"}
          estilo={estilos.vacio}
        />
      ) : (
        <FlatList
          key={`columnas-${columnas}`}
          data={lista}
          keyExtractor={(c) => c.id}
          numColumns={columnas}
          columnWrapperStyle={columnas > 1 ? estilos.columnas : undefined}
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => envolver(tarjeta(item), item.id, 12)}
        />
      )}
      <DialogoMotivo
        pedido={pedido}
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
  lista: { paddingTop: 2, paddingBottom: 16 },
  columnas: { gap: 12 },
  vacio: { marginTop: 12 },
});
