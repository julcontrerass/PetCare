/* Migrado de HomeAdminActivity.mostrarCuenta + layout sheet_admin_cuenta. */
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AdminRepo } from "../../data/repositorio/adminRepo";
import { Sesion } from "../../data/sesion";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { HojaInferior } from "../common/HojaInferior";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { BotonContorno } from "./BotonContorno";
import { FilaInfo, TarjetaInfo } from "./FilaInfo";

export interface HojaCuentaAdminProps {
  visible: boolean;
  alCerrar: () => void;
}

/** Pide confirmar y cierra la sesión (en Android el administrador cerraba sin preguntar; ahora se confirma en toda la app). */
export function cerrarSesionConfirmando(): void {
  Avisos.confirmar({
    titulo: "¿Cerrar sesión?",
    mensaje: "Vas a tener que ingresar de nuevo con tu correo y tu contraseña.",
    textoAceptar: "Cerrar sesión",
    textoCancelar: "Cancelar",
    peligro: false,
    icono: "salir",
    alAceptar: () => {
      void Sesion.cerrarYVolver();
    },
  });
}

/** Cuenta del administrador: correo, resumen de la plataforma y cerrar sesión. */
export function HojaCuentaAdmin({ visible, alCerrar }: HojaCuentaAdminProps) {
  const pendientes = AdminRepo.pendientesRevisionCount();
  const textoPendientes = pendientes === 0 ? "Ninguna" : pendientes === 1 ? "1 pendiente" : `${pendientes} pendientes`;
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar} anchoMaximo={560}>
      <LinearGradient colors={["#0B2A4A", "#0B6E73"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
        <View style={estilos.avatar}>
          <Texto variante="titulo" tamano={26} color={Colores.white}>AD</Texto>
        </View>
        <Texto variante="titulo" tamano={21} color={Colores.white} style={estilos.nombre}>Administrador</Texto>
        <Texto variante="subtitulo" tamano={14} color="#E6FFFFFF" style={estilos.correo}>{Sesion.perfil?.email ?? ""}</Texto>
        <View style={estilos.acceso}>
          <Texto variante="etiqueta" tamano={10.5} color={Colores.white}>Acceso total</Texto>
        </View>
      </LinearGradient>

      <TarjetaInfo estilo={estilos.tarjeta}>
        <FilaInfo
          icono="botiquin"
          etiqueta="Veterinarios"
          valor={`${AdminRepo.vetsActivos()} activos de ${AdminRepo.listaVeterinarios.length}`}
        />
        <FilaInfo
          icono="persona"
          etiqueta="Dueños y mascotas"
          valor={`${AdminRepo.listaDuenos.length} dueños · ${AdminRepo.totalMascotas()} mascotas`}
          separador
        />
        <FilaInfo icono="checkCirculo" etiqueta="Altas por revisar" valor={textoPendientes} separador />
      </TarjetaInfo>

      <BotonContorno
        titulo="Cerrar sesión"
        icono="salir"
        color={Colores.dangerRed}
        alto={54}
        onPress={() => {
          alCerrar();
          cerrarSesionConfirmando();
        }}
        estilo={estilos.cerrarSesion}
      />
      <Boton titulo="Volver" variante="texto" alto={48} onPress={alCerrar} estilo={estilos.volver} />
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  hero: { borderRadius: 22, padding: 20, alignItems: "center", marginTop: 4 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: "#33FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  nombre: { marginTop: 12 },
  correo: { marginTop: 2 },
  acceso: { marginTop: 10, backgroundColor: "#33FFFFFF", borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  tarjeta: { marginTop: 16 },
  cerrarSesion: { marginTop: 18 },
  volver: { marginTop: 4 },
});
