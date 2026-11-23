/* Migrado de HomeAdminActivity.mostrarDetalleDueno + layout sheet_admin_dueno. */
import { StyleSheet, View } from "react-native";
import { AdminRepo, type DuenoAdminItem } from "../../data/repositorio/adminRepo";
import { Fechas } from "../../util/fechas";
import { Boton } from "../common/Boton";
import { HojaInferior } from "../common/HojaInferior";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { AdminUi, AvatarAdmin, EtiquetaAdmin } from "./AdminUi";
import { BotonContorno } from "./BotonContorno";
import { FilaInfo, TarjetaInfo } from "./FilaInfo";

export interface HojaDuenoAdminProps {
  dueno: DuenoAdminItem | null;
  visible: boolean;
  alCerrar: () => void;
  alPedirSuspension: (dueno: DuenoAdminItem) => void;
  alReactivar: (dueno: DuenoAdminItem) => void;
}

/** Detalle de un dueño: datos, mascotas, llamar/escribir y suspender o reactivar la cuenta. */
export function HojaDuenoAdmin({ dueno, visible, alCerrar, alPedirSuspension, alReactivar }: HojaDuenoAdminProps) {
  if (!dueno) return <HojaInferior visible={false} alCerrar={alCerrar}>{null}</HojaInferior>;
  const estilo = AdminUi.estiloDueno(dueno.estado);
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar} anchoMaximo={560}>
      <View style={estilos.cabecera}>
        <AvatarAdmin nombre={dueno.nombre} fotoPath={dueno.fotoPath} />
        <View style={estilos.cabeceraTextos}>
          <Texto variante="titulo" tamano={20}>{dueno.nombre}</Texto>
          <EtiquetaAdmin texto={estilo.texto} tono={estilo.tono} vertical={4} horizontal={10} estilo={{ marginTop: 6 }} />
        </View>
      </View>

      {dueno.motivo.trim() ? (
        <View style={estilos.aviso}>
          <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark}>{`Motivo de la suspensión: ${dueno.motivo}`}</Texto>
        </View>
      ) : null}

      <TarjetaInfo estilo={estilos.tarjeta}>
        <FilaInfo icono="persona" etiqueta="DNI" valor={dueno.dni} />
        <FilaInfo icono="correo" etiqueta="Correo electrónico" valor={dueno.email} separador />
        <FilaInfo icono="telefono" etiqueta="Teléfono" valor={dueno.telefono} separador />
        <FilaInfo icono="ubicacion" etiqueta="Dirección" valor={dueno.direccion} separador />
        <FilaInfo
          icono="calendario"
          etiqueta="Se registró"
          valor={`${Fechas.corta(dueno.fechaRegistro)} (${AdminUi.hace(dueno.fechaRegistro).toLowerCase()})`}
          separador
        />
        <FilaInfo icono="perro" etiqueta="Mascotas" valor={dueno.mascotas.map((m) => `• ${m}`).join("\n")} separador />
      </TarjetaInfo>

      <View style={estilos.contacto}>
        <BotonContorno titulo="Llamar" icono="telefono" alto={48} onPress={() => AdminUi.llamar(dueno.telefono)} estilo={estilos.mitad} />
        <BotonContorno titulo="Correo" icono="correo" alto={48} onPress={() => AdminUi.escribir(dueno.email)} estilo={estilos.mitad} />
      </View>

      {dueno.estado === AdminRepo.SUSPENDIDO ? (
        <Boton titulo="Reactivar cuenta" onPress={() => alReactivar(dueno)} estilo={estilos.principal} />
      ) : (
        <BotonContorno titulo="Suspender cuenta" color={Colores.dangerRed} onPress={() => alPedirSuspension(dueno)} estilo={estilos.secundario} />
      )}
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  cabeceraTextos: { flex: 1, minWidth: 0, marginLeft: 14 },
  aviso: { marginTop: 14, backgroundColor: "#E3F3F1", borderRadius: 16, padding: 12 },
  tarjeta: { marginTop: 16 },
  contacto: { flexDirection: "row", gap: 16, marginTop: 16 },
  mitad: { flex: 1 },
  principal: { marginTop: 10 },
  secundario: { marginTop: 8 },
});
