/* Migrado de ui/admin/AdminAdapters.kt (filas de las listas) y de AdminUi.vistaActividad. */
import { Pressable, StyleSheet, View } from "react-native";
import { AdminRepo, type ActividadAdmin, type DuenoAdminItem, type VetAdminItem } from "../../data/repositorio/adminRepo";
import { Boton } from "../common/Boton";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { AdminUi, AvatarAdmin, EtiquetaAdmin } from "./AdminUi";
import { BotonContorno } from "./BotonContorno";

export interface FilaVetProps {
  vet: VetAdminItem;
  alAbrir: (vet: VetAdminItem) => void;
  alAprobar: (vet: VetAdminItem) => void;
  alRechazar: (vet: VetAdminItem) => void;
}

/** item_admin_vet: avatar, nombre, matrícula y clínica, estado, especialidades, correo y, si está en revisión, los botones. */
export function FilaVet({ vet, alAbrir, alAprobar, alRechazar }: FilaVetProps) {
  const pendiente = vet.estado === AdminRepo.PENDIENTE;
  const foco = useFoco();
  const datos = (
    <>
      <View style={estilos.fila}>
        <AvatarAdmin nombre={vet.nombre} fotoPath={vet.fotoPath} />
        <View style={estilos.textos}>
          <Texto variante="titulo" tamano={16} numberOfLines={1}>{vet.nombre}</Texto>
          <Texto variante="subtitulo" tamano={13} numberOfLines={2}>{`Matrícula ${vet.matricula}\n${vet.clinica}`}</Texto>
        </View>
        <EtiquetaAdmin texto={AdminUi.estiloVet(vet.estado).texto} tono={AdminUi.estiloVet(vet.estado).tono} vertical={4} horizontal={10} />
      </View>
      <View style={[estilos.filaIcono, { marginTop: 12 }]}>
        <Icono nombre="vacuna" tamano={16} color={Colores.tealDark} estilo={estilos.icono} />
        <Texto variante="cuerpo" tamano={13.5} numberOfLines={2} style={estilos.textoIcono}>
          {vet.especialidades.trim() ? vet.especialidades : "Sin especialidades"}
        </Texto>
      </View>
      <View style={[estilos.filaIcono, { marginTop: 6 }]}>
        <Icono nombre="correo" tamano={16} color={Colores.tealDark} estilo={estilos.icono} />
        <Texto variante="subtitulo" tamano={13} numberOfLines={1} style={estilos.textoIcono}>{vet.email}</Texto>
      </View>
    </>
  );
  if (!pendiente) {
    return <Tarjeta relleno={14} onPress={() => alAbrir(vet)} accessibilityLabel={`Veterinario ${vet.nombre}`}>{datos}</Tarjeta>;
  }
  // En revisión la tarjeta tiene sus propios botones: la parte de los datos abre el detalle y los botones van aparte
  // (un botón no puede ir adentro de otro)
  return (
    <Tarjeta relleno={14}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`Veterinario ${vet.nombre}`} onPress={() => alAbrir(vet)}
        {...foco.props} style={[cursorTocable, estiloFoco(foco.enfocado)]}
      >
        {datos}
      </Pressable>
      <View style={estilos.acciones}>
        <BotonContorno titulo="Rechazar" color={Colores.dangerRed} alto={46} onPress={() => alRechazar(vet)} estilo={estilos.mitad} />
        <Boton titulo="Dar de alta" alto={46} onPress={() => alAprobar(vet)} estilo={estilos.mitad} />
      </View>
    </Tarjeta>
  );
}

export interface FilaDuenoProps {
  dueno: DuenoAdminItem;
  alAbrir: (dueno: DuenoAdminItem) => void;
}

/** item_admin_dueno: avatar, nombre, DNI y correo, cantidad de mascotas, estado y flecha. */
export function FilaDueno({ dueno, alAbrir }: FilaDuenoProps) {
  const cantidad = dueno.mascotas.filter((m) => m !== "Sin mascotas por ahora").length;
  const textoMascotas = cantidad === 0 ? "Sin mascotas" : cantidad === 1 ? "1 mascota" : `${cantidad} mascotas`;
  const estilo = AdminUi.estiloDueno(dueno.estado);
  return (
    <Tarjeta relleno={14} onPress={() => alAbrir(dueno)} accessibilityLabel={`Dueño ${dueno.nombre}`} estilo={estilos.fila}>
      <AvatarAdmin nombre={dueno.nombre} fotoPath={dueno.fotoPath} />
      <View style={estilos.textos}>
        <Texto variante="titulo" tamano={16} numberOfLines={1}>{dueno.nombre}</Texto>
        <Texto variante="subtitulo" tamano={13} numberOfLines={2}>{`DNI ${dueno.dni}\n${dueno.email}`}</Texto>
        <View style={estilos.etiquetas}>
          <EtiquetaAdmin texto={textoMascotas} tono="neutroTeal" />
          <EtiquetaAdmin texto={estilo.texto} tono={estilo.tono} estilo={estilos.separada} />
        </View>
      </View>
      <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
    </Tarjeta>
  );
}

export interface FilaPendienteProps {
  vet: VetAdminItem;
  alAbrir: (vet: VetAdminItem) => void;
}

/** item_admin_pendiente: fila del inicio con una solicitud de alta por revisar. */
export function FilaPendiente({ vet, alAbrir }: FilaPendienteProps) {
  return (
    <Tarjeta relleno={12} onPress={() => alAbrir(vet)} accessibilityLabel={`Revisar a ${vet.nombre}`} estilo={estilos.fila}>
      <AvatarAdmin nombre={vet.nombre} fotoPath={vet.fotoPath} />
      <View style={[estilos.textos, { marginRight: 12 }]}>
        <Texto variante="titulo" tamano={15.5} numberOfLines={1}>{vet.nombre}</Texto>
        <Texto variante="subtitulo" tamano={13} numberOfLines={1}>{`Matrícula ${vet.matricula} · ${vet.clinica}`}</Texto>
        <EtiquetaAdmin
          texto={`Pidió el alta · ${AdminUi.hace(vet.fechaRegistro).toLowerCase()}`}
          tono="aviso"
          estilo={{ marginTop: 6 }}
        />
      </View>
      <View style={estilos.revisar}>
        <Texto variante="boton" tamano={13.5}>Revisar</Texto>
      </View>
    </Tarjeta>
  );
}

/** item_admin_actividad: un movimiento de la plataforma (se usa en el inicio y en la pestaña de actividad). */
/** Con [alAbrir] se toca y lleva a lo que menciona (la cuenta o la veterinaria); sin él es solo texto. */
export function FilaActividad({ actividad, alAbrir }: { actividad: ActividadAdmin; alAbrir?: () => void }) {
  const { icono, color } = AdminUi.iconoActividad(actividad.tipo);
  return (
    <Tarjeta relleno={12} estilo={estilos.fila} onPress={alAbrir} accessibilityLabel={alAbrir ? actividad.texto : undefined}>
      <View style={estilos.cajaIcono}>
        <Icono nombre={icono} tamano={20} color={color} />
      </View>
      <View style={[estilos.textos, { marginLeft: 12 }]}>
        <Texto variante="cuerpo" tamano={14} numberOfLines={3}>{actividad.texto}</Texto>
        <Texto variante="chico" tamano={12} style={{ marginTop: 2 }}>{AdminUi.cuando(actividad.cuando)}</Texto>
      </View>
      {alAbrir ? <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} /> : null}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center" },
  textos: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  filaIcono: { flexDirection: "row", alignItems: "center" },
  icono: { marginRight: 8 },
  textoIcono: { flex: 1, minWidth: 0 },
  acciones: { flexDirection: "row", marginTop: 14, gap: 16 },
  mitad: { flex: 1 },
  etiquetas: { flexDirection: "row", marginTop: 6 },
  separada: { marginLeft: 6 },
  revisar: { backgroundColor: Colores.primaryTeal, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  cajaIcono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colores.lightTeal,
    alignItems: "center",
    justifyContent: "center",
  },
});
