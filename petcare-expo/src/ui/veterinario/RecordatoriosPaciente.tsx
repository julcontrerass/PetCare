/*
 * Migrado de ui/veterinario/RecordatoriosPaciente.kt. Recordatorios que el veterinario le deja a un paciente (un
 * control, una dosis, un estudio): el dueño los ve en su lista y recibe un aviso. Acá se ven, editan y borran los que
 * dejó el propio veterinario.
 */
import { useState } from "react";
import { View } from "react-native";
import type { Paciente } from "../../data/repositorio/pacientesRepo";
import { RecordatoriosRepo, type RecordatorioManual } from "../../data/repositorio/recordatoriosRepo";
import { Fechas } from "../../util/fechas";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { EditorRecordatorio } from "../common/EditorRecordatorio";
import { HojaInferior } from "../common/HojaInferior";
import { Texto } from "../common/Texto";

export interface RecordatoriosPacienteProps {
  visible: boolean;
  paciente: Paciente;
  alCerrar: () => void;
}

export function RecordatoriosPaciente({ visible, paciente, alCerrar }: RecordatoriosPacienteProps) {
  const [, redibujar] = useState(0);
  const tick = () => redibujar((n) => n + 1);
  const [editor, setEditor] = useState<{ existente: RecordatorioManual | null } | null>(null);
  const [opciones, setOpciones] = useState<RecordatorioManual | null>(null);

  const propios = RecordatoriosRepo.deMascota(paciente.id).filter((r) => r.esMio);
  const mascotas = [{ id: paciente.id, nombre: paciente.nombre }];

  return (
    <>
      <HojaInferior visible={visible && opciones === null && editor === null} alCerrar={alCerrar}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header">{`Recordatorios de ${paciente.nombre}`}</Texto>
        {propios.length === 0 ? (
          <Texto variante="subtitulo" tamano={14} style={{ marginTop: 10 }}>
            {`Todavía no dejaste recordatorios para ${paciente.nombre}. El dueño recibe un aviso cuando creás uno.`}
          </Texto>
        ) : (
          <View style={{ marginTop: 8 }}>
            {propios.map((r) => (
              <Boton
                key={r.id} variante="suave" alto={60} estilo={{ marginTop: 8 }} accessibilityLabel={r.titulo}
                titulo={`${r.titulo}\n${Fechas.corta(r.fecha)}${r.hora ? ` · ${r.hora} hs` : ""}`}
                onPress={() => setOpciones(r)}
              />
            ))}
          </View>
        )}
        <Boton titulo="Nuevo" alto={50} estilo={{ marginTop: 16 }} onPress={() => setEditor({ existente: null })} />
        <Boton titulo="Cerrar" variante="texto" alto={50} estilo={{ marginTop: 4 }} onPress={alCerrar} />
      </HojaInferior>

      <HojaInferior visible={visible && opciones !== null} alCerrar={() => setOpciones(null)}>
        {opciones ? (
          <View>
            <Texto variante="titulo" tamano={20} accessibilityRole="header">{opciones.titulo}</Texto>
            <Boton titulo="Editar" variante="suave" alto={50} estilo={{ marginTop: 14 }} onPress={() => { setEditor({ existente: opciones }); setOpciones(null); }} />
            <Boton
              titulo="Eliminar" variante="suave" alto={50} estilo={{ marginTop: 8 }}
              onPress={() => {
                const r = opciones;
                setOpciones(null);
                Avisos.confirmar({
                  titulo: "¿Eliminar el recordatorio?", mensaje: `"${r.titulo}" también deja de verse en la lista del dueño.`, textoAceptar: "Eliminar",
                  alAceptar: () => {
                    RecordatoriosRepo.borrar(r);
                    tick();
                  },
                });
              }}
            />
            <Boton titulo="Cancelar" variante="texto" alto={50} estilo={{ marginTop: 4 }} onPress={() => setOpciones(null)} />
          </View>
        ) : null}
      </HojaInferior>

      <EditorRecordatorio
        visible={visible && editor !== null} alCerrar={() => setEditor(null)} mascotas={mascotas} existente={editor?.existente ?? null}
        alGuardar={() => {
          if (editor?.existente == null) Avisos.mostrar(`Le avisamos al dueño de ${paciente.nombre}`);
          tick();
        }}
      />
    </>
  );
}
