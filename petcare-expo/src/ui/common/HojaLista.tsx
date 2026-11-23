import { StyleSheet, View } from "react-native";
import { Colores } from "./tema";
import { Boton } from "./Boton";
import { HojaInferior } from "./HojaInferior";
import { Icono, type NombreIcono } from "./Icono";
import { ImagenRemota } from "./ImagenRemota";
import { Tarjeta } from "./Tarjeta";
import { Texto } from "./Texto";

/** Una opción de la lista; muestra la foto si hay una y, si no, el [icono]. */
export interface FilaHojaLista {
  titulo: string;
  subtitulo: string;
  icono: NombreIcono;
  fotoUri?: string | null;
  fotoPath?: string | null;
  alTocar: () => void;
}

export interface HojaListaProps {
  visible: boolean;
  alCerrar: () => void;
  titulo: string;
  subtitulo: string;
  filas: FilaHojaLista[];
  /** Botón principal debajo de la lista (por ejemplo "Agregar mascota"). */
  textoPrincipal?: string;
  alPrincipal?: () => void;
}

/** Hoja inferior con una lista de opciones tocables para elegir una (mascotas, veterinarios...). Port de HojaLista.kt. */
export function HojaLista({ visible, alCerrar, titulo, subtitulo, filas, textoPrincipal, alPrincipal }: HojaListaProps) {
  return (
    <HojaInferior
      visible={visible}
      alCerrar={alCerrar}
      pie={
        <View>
          {textoPrincipal ? (
            <Boton
              titulo={textoPrincipal}
              alto={50}
              onPress={() => {
                alCerrar();
                alPrincipal?.();
              }}
              estilo={estilos.principal}
            />
          ) : null}
          <Boton titulo="Cerrar" variante="secundario" alto={50} onPress={alCerrar} />
        </View>
      }
    >
      <Texto variante="titulo" tamano={21} accessibilityRole="header">{titulo}</Texto>
      <Texto variante="subtitulo" tamano={13.5} style={estilos.subtitulo}>{subtitulo}</Texto>
      <View style={estilos.lista}>
        {filas.map((fila, i) => (
          <Tarjeta
            key={`${fila.titulo}-${i}`}
            relleno={12}
            accessibilityLabel={`${fila.titulo}. ${fila.subtitulo}`}
            estilo={estilos.fila}
            onPress={() => {
              alCerrar();
              fila.alTocar();
            }}
          >
            <View style={estilos.contenido}>
              <ImagenRemota
                fotoUri={fila.fotoUri}
                fotoPath={fila.fotoPath}
                estilo={estilos.marco}
                respaldo={<Icono nombre={fila.icono} tamano={22} color={Colores.tealDark} />}
              />
              <View style={estilos.textos}>
                <Texto variante="cuerpo" negrita numberOfLines={1}>{fila.titulo}</Texto>
                <Texto variante="subtitulo" tamano={13} numberOfLines={2}>{fila.subtitulo}</Texto>
              </View>
              <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
            </View>
          </Tarjeta>
        ))}
      </View>
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  subtitulo: { marginTop: 4 },
  lista: { marginTop: 16 },
  fila: { marginBottom: 10 },
  contenido: { flexDirection: "row", alignItems: "center" },
  marco: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colores.lightTeal },
  textos: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  principal: { marginBottom: 8 },
});
