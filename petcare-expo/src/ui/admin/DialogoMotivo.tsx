/* Migrado de HomeAdminActivity.pedirMotivo + layout dialog_motivo_admin. */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Campo } from "../common/Campo";
import { Chip } from "../common/Chip";
import { DialogoCentral } from "../common/DialogoCentral";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

export interface PedidoMotivo {
  titulo: string;
  ayuda: string;
  sugerencias: string[];
  /** Texto del botón que confirma ("Rechazar", "Suspender"). */
  confirmar: string;
}

export interface DialogoMotivoProps {
  /** El pedido a mostrar; null mantiene el diálogo cerrado. */
  pedido: PedidoMotivo | null;
  alConfirmar: (motivo: string) => void;
  alCancelar: () => void;
}

/** Pide el motivo de un rechazo o una suspensión (mínimo 5 caracteres); las sugerencias lo completan de un toque. */
export function DialogoMotivo({ pedido, alConfirmar, alCancelar }: DialogoMotivoProps) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Cada pedido empieza con el campo vacío
  const abierto = pedido != null;
  const titulo = pedido?.titulo;
  useEffect(() => {
    setMotivo("");
    setError(null);
  }, [abierto, titulo]);

  const confirmar = () => {
    const limpio = motivo.trim();
    if (limpio.length < 5) {
      setError("Escribí el motivo");
      return;
    }
    alConfirmar(limpio);
  };

  return (
    <DialogoCentral visible={pedido != null} alCerrar={alCancelar} anchoMaximo={440}>
      <Texto variante="titulo" tamano={20}>{pedido?.titulo ?? ""}</Texto>
      <Texto variante="subtitulo" tamano={13.5} style={estilos.ayuda}>{pedido?.ayuda ?? ""}</Texto>
      <View style={estilos.sugerencias}>
        {(pedido?.sugerencias ?? []).map((texto) => (
          <Chip
            key={texto}
            texto={texto}
            tono="sinSeleccionar"
            onPress={() => {
              setMotivo(texto);
              setError(null);
            }}
          />
        ))}
      </View>
      <Campo
        placeholder="Motivo (se lo mostramos al usuario)"
        accessibilityLabel="Motivo"
        value={motivo}
        onChangeText={(t) => {
          setMotivo(t);
          if (error) setError(null);
        }}
        error={error}
        multilinea
        autoCapitalize="sentences"
        estilo={estilos.campo}
      />
      <View style={estilos.botones}>
        <BotonTexto titulo="Cancelar" color={Colores.textGray} onPress={alCancelar} />
        <BotonTexto titulo={pedido?.confirmar ?? ""} color={Colores.dangerRed} negrita onPress={confirmar} />
      </View>
    </DialogoCentral>
  );
}

function BotonTexto({ titulo, color, negrita, onPress }: { titulo: string; color: string; negrita?: boolean; onPress: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      {...foco.props}
      style={[estilos.boton, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="boton" tamano={14} color={color} peso={negrita ? "bold" : "medium"}>{titulo}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  ayuda: { marginTop: 4 },
  sugerencias: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  campo: { marginTop: 10 },
  botones: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  boton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
});
