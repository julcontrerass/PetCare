/* Migrado de HomeAdminActivity.mostrarDetalleVet + layout sheet_admin_vet. */
import { StyleSheet, View } from "react-native";
import { AdminRepo, type VetAdminItem } from "../../data/repositorio/adminRepo";
import { Fechas } from "../../util/fechas";
import { Boton } from "../common/Boton";
import { HojaInferior } from "../common/HojaInferior";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { AdminUi, AvatarAdmin, EtiquetaAdmin } from "./AdminUi";
import { BotonContorno } from "./BotonContorno";
import { FilaInfo, TarjetaInfo } from "./FilaInfo";

export interface HojaVetAdminProps {
  /** La cuenta a mostrar; con null (o con `visible` en false) la hoja está cerrada. */
  vet: VetAdminItem | null;
  visible: boolean;
  alCerrar: () => void;
  /** Baja la foto del carnet y la muestra. */
  alVerCredencial: (vet: VetAdminItem) => void;
  cargandoCredencial: boolean;
  alAprobar: (vet: VetAdminItem) => void;
  alPedirRechazo: (vet: VetAdminItem) => void;
  alPedirSuspension: (vet: VetAdminItem) => void;
  alReactivar: (vet: VetAdminItem) => void;
}

/** Detalle de un veterinario: datos, foto del carnet, llamar/escribir y las acciones según su estado. */
export function HojaVetAdmin({
  vet, visible, alCerrar, alVerCredencial, cargandoCredencial, alAprobar, alPedirRechazo, alPedirSuspension, alReactivar,
}: HojaVetAdminProps) {
  if (!vet) return <HojaInferior visible={false} alCerrar={alCerrar}>{null}</HojaInferior>;

  let aviso: string | null = null;
  if (vet.estado === AdminRepo.PENDIENTE) {
    aviso =
      `Verificá la matrícula ${vet.matricula} en el colegio profesional antes de dar el alta.` +
      (vet.tambienEsDueno
        ? "\n\nYa tiene una cuenta de dueño: aprobarla suma el rol de veterinario, sin tocar lo demás."
        : "");
  } else if (vet.motivo.trim()) {
    aviso = `Motivo: ${vet.motivo}`;
  }
  const estilo = AdminUi.estiloVet(vet.estado);
  const sinCredencial = !vet.credencialPath || !vet.credencialPath.trim();

  return (
    <HojaInferior visible={visible} alCerrar={alCerrar} anchoMaximo={560}>
      <View style={estilos.cabecera}>
        <AvatarAdmin nombre={vet.nombre} fotoPath={vet.fotoPath} />
        <View style={estilos.cabeceraTextos}>
          <Texto variante="titulo" tamano={20}>{vet.nombre}</Texto>
          <EtiquetaAdmin texto={estilo.texto} tono={estilo.tono} vertical={4} horizontal={10} estilo={{ marginTop: 6 }} />
        </View>
      </View>

      {aviso ? (
        <View style={estilos.aviso}>
          <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark}>{aviso}</Texto>
        </View>
      ) : null}

      <TarjetaInfo estilo={estilos.tarjeta}>
        <FilaInfo icono="persona" etiqueta="DNI" valor={vet.dni} />
        <FilaInfo icono="medico" etiqueta="Matrícula" valor={vet.matricula} separador />
        <FilaInfo icono="botiquin" etiqueta="Veterinaria" valor={vet.clinica} separador />
        <FilaInfo icono="ubicacion" etiqueta="Dirección" valor={vet.direccion} separador />
        <FilaInfo icono="telefono" etiqueta="Teléfono" valor={vet.telefono} separador />
        <FilaInfo icono="correo" etiqueta="Correo electrónico" valor={vet.email} separador />
        <FilaInfo icono="vacuna" etiqueta="Especialidades" valor={vet.especialidades} separador />
        <FilaInfo icono="reloj" etiqueta="Días y horarios" valor={vet.diasYHorarios} separador />
        <FilaInfo
          icono="calendario"
          etiqueta="Se registró"
          valor={`${Fechas.corta(vet.fechaRegistro)} (${AdminUi.hace(vet.fechaRegistro).toLowerCase()})`}
          separador
        />
      </TarjetaInfo>

      {/* La foto del carnet o matrícula es lo que se compara con el colegio profesional para dar el alta */}
      <BotonContorno
        titulo={sinCredencial ? "No cargó la foto del carnet" : "Ver foto del carnet o matrícula"}
        deshabilitado={sinCredencial}
        cargando={cargandoCredencial}
        onPress={() => alVerCredencial(vet)}
        estilo={estilos.credencial}
      />

      <View style={estilos.contacto}>
        <BotonContorno titulo="Llamar" icono="telefono" alto={48} onPress={() => AdminUi.llamar(vet.telefono)} estilo={estilos.mitad} />
        <BotonContorno titulo="Correo" icono="correo" alto={48} onPress={() => AdminUi.escribir(vet.email)} estilo={estilos.mitad} />
      </View>

      {vet.estado === AdminRepo.PENDIENTE ? (
        <>
          <Boton titulo="Dar de alta" onPress={() => alAprobar(vet)} estilo={estilos.principal} />
          <BotonContorno titulo="Rechazar solicitud" color={Colores.dangerRed} onPress={() => alPedirRechazo(vet)} estilo={estilos.secundario} />
        </>
      ) : vet.estado === AdminRepo.ACTIVO ? (
        <BotonContorno titulo="Suspender cuenta" color={Colores.dangerRed} onPress={() => alPedirSuspension(vet)} estilo={estilos.secundario} />
      ) : vet.estado === AdminRepo.SUSPENDIDO ? (
        <Boton titulo="Reactivar cuenta" onPress={() => alReactivar(vet)} estilo={estilos.principal} />
      ) : (
        <Boton titulo="Dar de alta igualmente" onPress={() => alAprobar(vet)} estilo={estilos.principal} />
      )}
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  cabeceraTextos: { flex: 1, minWidth: 0, marginLeft: 14 },
  aviso: { marginTop: 14, backgroundColor: "#E3F3F1", borderRadius: 16, padding: 12 },
  tarjeta: { marginTop: 16 },
  credencial: { marginTop: 14 },
  contacto: { flexDirection: "row", gap: 16, marginTop: 16 },
  mitad: { flex: 1 },
  principal: { marginTop: 10 },
  secundario: { marginTop: 8 },
});
