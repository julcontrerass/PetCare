/*
 * Migrado de ui/veterinario/ArchivosFragment.kt + ResumenAdapter.kt (fragment_archivos.xml,
 * item_detalle_paciente_resumen.xml). Pestaña "Archivos": estudios, recetas y documentos del paciente (bucket privado).
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ArchivosRepo, type ArchivoItem } from "../../data/repositorio/archivosRepo";
import type { Paciente } from "../../data/repositorio/pacientesRepo";
import { Errores } from "../../util/errores";
import { ArchivosUi } from "../common/ArchivosUi";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { DialogoCentral } from "../common/DialogoCentral";
import { EstadoVacio } from "../common/EstadoVacio";
import { HojaInferior } from "../common/HojaInferior";
import { Icono, type NombreIcono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

/** `ArchivoItem.icono` es un nombre de MaterialCommunityIcons; el kit usa nombres semánticos. */
function iconoDe(item: ArchivoItem): NombreIcono {
  return item.icono === "pencil" ? "editar" : item.icono === "camera" ? "camara" : "lista";
}

function FilaResumen({ titulo, subtitulo, icono, alTocar }: { titulo: string; subtitulo: string; icono: NombreIcono; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${titulo}. ${subtitulo}`} onPress={alTocar}
      {...foco.props} style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.icono}><Icono nombre={icono} tamano={22} color={Colores.primaryTeal} /></View>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Texto variante="titulo" tamano={15}>{titulo}</Texto>
        <Texto variante="chico" tamano={13}>{subtitulo}</Texto>
      </View>
      <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
    </Pressable>
  );
}

export interface ArchivosVetProps {
  paciente: Paciente;
  /** Durante un turno los archivos se adjuntan desde el informe, para que queden ligados a esa consulta. */
  enTurno: boolean;
}

export function ArchivosVet({ paciente, enTurno }: ArchivosVetProps) {
  const [, redibujar] = useState(0);
  const tick = () => redibujar((n) => n + 1);
  const [opciones, setOpciones] = useState<ArchivoItem | null>(null);
  const [renombrando, setRenombrando] = useState<ArchivoItem | null>(null);
  const [nombre, setNombre] = useState("");

  // La lista de archivos se pide al servidor al abrir la pestaña
  useEffect(() => {
    let vigente = true;
    ArchivosRepo.cargar(paciente.id).then(() => vigente && tick()).catch((e) => Avisos.error(Errores.mensaje(e)));
    return () => {
      vigente = false;
    };
  }, [paciente.id]);

  const archivos = ArchivosRepo.dePaciente(paciente.id);

  const subir = async () => {
    const elegido = await ArchivosUi.elegir();
    if (elegido === null) return;
    try {
      await ArchivosRepo.agregar(paciente.id, elegido.nombre, elegido.extension, elegido.bytes, elegido.mime);
      tick();
      Avisos.mostrar(`Archivo '${elegido.nombre}' subido correctamente`);
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  };

  const guardarNombre = () => {
    const nuevo = nombre.trim();
    if (renombrando === null) return;
    if (nuevo !== "") {
      ArchivosRepo.renombrar(renombrando, nuevo);
      setRenombrando(null);
      tick();
      Avisos.mostrar("Nombre actualizado");
    } else {
      Avisos.mostrar("El nombre no puede estar vacío");
    }
  };

  return (
    <View>
      {archivos.length === 0 ? (
        <EstadoVacio
          icono="documento" titulo="Sin archivos"
          mensaje={enTurno ? "Adjuntá archivos desde la pestaña Informe para que queden en esta consulta" : "Subí estudios, recetas o documentos del paciente"}
        />
      ) : (
        archivos.map((a) => <FilaResumen key={a.id} titulo={a.nombre} subtitulo={a.fecha} icono={iconoDe(a)} alTocar={() => setOpciones(a)} />)
      )}
      {!enTurno ? <Boton titulo="Subir archivo" icono="subir" alto={52} estilo={{ marginTop: 16 }} onPress={() => void subir()} /> : null}

      <HojaInferior visible={opciones !== null} alCerrar={() => setOpciones(null)}>
        {opciones ? (
          <View>
            <Texto variante="titulo" tamano={20} accessibilityRole="header">{opciones.nombre}</Texto>
            <Boton
              titulo="Abrir / Visualizar" variante="suave" alto={50} estilo={{ marginTop: 14 }}
              onPress={() => {
                const a = opciones;
                setOpciones(null);
                void ArchivosUi.abrir(ArchivosRepo.BUCKET, a.storagePath, a.tipoExtension);
              }}
            />
            <Boton
              titulo="Cambiar nombre" variante="suave" alto={50} estilo={{ marginTop: 8 }}
              onPress={() => {
                setNombre(opciones.nombre);
                setRenombrando(opciones);
                setOpciones(null);
              }}
            />
            <Boton
              titulo="Eliminar archivo" variante="suave" alto={50} estilo={{ marginTop: 8 }}
              onPress={() => {
                const a = opciones;
                setOpciones(null);
                Avisos.confirmar({
                  titulo: "¿Eliminar el archivo?", mensaje: `Se borra '${a.nombre}' de la ficha. No se puede deshacer.`,
                  textoAceptar: "Eliminar", textoCancelar: "Cancelar",
                  alAceptar: () => {
                    ArchivosRepo.eliminar(a);
                    tick();
                    Avisos.mostrar("Archivo eliminado");
                  },
                });
              }}
            />
            <Boton titulo="Cancelar" variante="texto" alto={50} estilo={{ marginTop: 4 }} onPress={() => setOpciones(null)} />
          </View>
        ) : null}
      </HojaInferior>

      <DialogoCentral visible={renombrando !== null} alCerrar={() => setRenombrando(null)}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header">Cambiar nombre del archivo</Texto>
        <Campo
          placeholder="Nombre del archivo" accessibilityLabel="Nombre del archivo" value={nombre} onChangeText={setNombre}
          onSubmitEditing={guardarNombre} estilo={{ marginTop: 12 }}
        />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
          <Boton titulo="Cancelar" variante="texto" alto={44} estilo={{ alignSelf: "auto", minWidth: 100 }} onPress={() => setRenombrando(null)} />
          <Boton titulo="Guardar" variante="texto" alto={44} estilo={{ alignSelf: "auto", minWidth: 100 }} onPress={guardarNombre} />
        </View>
      </DialogoCentral>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", backgroundColor: Colores.white, borderRadius: 18, padding: 12, marginTop: 10, ...sombra(1) },
  icono: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
});
