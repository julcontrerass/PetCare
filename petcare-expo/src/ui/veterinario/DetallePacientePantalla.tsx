/*
 * Migrado de ui/veterinario/DetallePacienteActivity.kt (activity_detalle_paciente.xml). Ficha del paciente con cuatro
 * pestañas (Informe, Información, Historial clínico, Archivos) y el menú para contactar al dueño, emitir certificados y
 * crear la cuenta del dueño. Ruta: `/vet/paciente/[id]?evento=TURNO_ID` (`evento` es el turno cuyo informe se abre, el
 * `EXTRA_EVENTO_ID` de Android; en la web se mantiene al recargar). Las pestañas quedan montadas (como el ViewPager2)
 * para no perder lo que se está escribiendo en el informe.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PacientesRepo , comoDocumento, razaYSexo } from "../../data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { SaludRepo } from "../../data/repositorio/saludRepo";
import { TiposMascota } from "../../model/tiposMascota";
import { LocalDate } from "../../util/tiempo";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { BotonIcono } from "../common/BotonIcono";
import { Boton } from "../common/Boton";
import { Contacto } from "../common/Contacto";
import { DocumentosPdf } from "../common/DocumentosPdf";
import { HojaInferior } from "../common/HojaInferior";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { PantallaBase } from "../common/PantallaBase";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { ArchivosVet } from "./ArchivosVet";
import { cerrarPantalla } from "./estadoVet";
import { HistorialPacienteVet } from "./HistorialPacienteVet";
import { InformacionVet } from "./InformacionVet";
import { InformeVet } from "./InformeVet";
import { RecordatoriosPaciente } from "./RecordatoriosPaciente";

/** Ícono del animal (el `TiposMascota.icono` del Kotlin devolvía un drawable). */
function iconoDeEspecie(especie: string): NombreIcono {
  switch (TiposMascota.icono(especie)) {
    case "dog": return "perro";
    case "cat": return "gato";
    case "bird": return "ave";
    case "snake": return "reptil";
    case "fish": return "pez";
    case "rodent": return "roedor";
    default: return "mascotas";
  }
}

const PESTANAS = ["Informe", "Información", "Historial clínico", "Archivos"] as const;

function Pestana({ texto, activa, alTocar }: { texto: string; activa: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="tab" accessibilityLabel={texto} accessibilityState={{ selected: activa }} onPress={alTocar}
      {...foco.props} style={[estilos.pestana, activa ? estilos.pestanaActiva : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={activa ? Colores.primaryTeal : Colores.textGray} numberOfLines={1}>{texto}</Texto>
    </Pressable>
  );
}

function FilaMenu({ texto, icono, alTocar }: { texto: string; icono: NombreIcono; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar}
      {...foco.props} style={[estilos.opcion, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Icono nombre={icono} tamano={22} color={Colores.primaryTeal} />
      <Texto variante="cuerpo" tamano={15} style={{ marginLeft: 14, flex: 1 }}>{texto}</Texto>
    </Pressable>
  );
}

export default function DetallePacientePantalla() {
  useSesionRequerida();
  useDatos();
  const { id, evento } = useLocalSearchParams<{ id?: string; evento?: string }>();
  const paciente = PacientesRepo.porId(typeof id === "string" ? id : null);
  const turnoId = typeof evento === "string" && evento !== "" ? evento : null;
  const [pestana, setPestana] = useState(0);
  const [menu, setMenu] = useState(false);
  const [recordatorios, setRecordatorios] = useState(false);

  useEffect(() => {
    if (paciente === null) {
      Avisos.mostrar("No se encontró la mascota");
      cerrarPantalla();
    }
  }, [paciente === null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (paciente === null) return <PantallaBase titulo="Ficha del paciente" alVolver={cerrarPantalla}>{null}</PantallaBase>;

  /** Arma el certificado con la matrícula del veterinario y abre el selector para compartirlo. */
  const generarCertificado = async (vacunacion: boolean) => {
    if (PerfilVetRepo.matricula.trim() === "") {
      Avisos.mostrar("Cargá tu matrícula en el perfil para emitir certificados");
      return;
    }
    const doc = comoDocumento(paciente);
    const archivo = vacunacion
      ? await DocumentosPdf.certificadoVacunacion(
          PerfilVetRepo.comoProfesional(), doc, LocalDate.now(),
          SaludRepo.registros.filter((r) => r.mascotaId === paciente.id && r.tipo === "VACUNA"),
        )
      : await DocumentosPdf.certificadoSalud(PerfilVetRepo.comoProfesional(), doc, LocalDate.now());
    await DocumentosPdf.compartir(archivo, (vacunacion ? "Certificado de vacunación de " : "Certificado de salud de ") + paciente.nombre);
  };

  // La ficha puede haber cambiado desde que se abrió (por ejemplo, al crearle la cuenta al dueño)
  const actual = PacientesRepo.porId(paciente.id) ?? paciente;
  const elegir = (accion: () => void | Promise<void>) => () => {
    setMenu(false);
    void accion();
  };

  return (
    <PantallaBase
      titulo="Ficha del paciente" alVolver={cerrarPantalla}
      derecha={<BotonIcono icono="masOpciones" accessibilityLabel="Más opciones del paciente" onPress={() => setMenu(true)} />}
    >
      <View style={estilos.hero}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ImagenRemota
            fotoPath={paciente.fotoPath} estilo={{ width: 76, height: 76, borderRadius: 20, backgroundColor: Colores.lightTeal }}
            respaldo={<Icono nombre={iconoDeEspecie(paciente.especie)} tamano={36} color={Colores.primaryTeal} />}
          />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Texto variante="titulo" tamano={24} color={Colores.white} accessibilityRole="header">{paciente.nombre}</Texto>
            <Texto variante="cuerpo" tamano={14} color="#FFFFFFE6">{razaYSexo(paciente)}</Texto>
            <View style={estilos.chip}><Texto variante="etiqueta" tamano={10.5} color={Colores.white}>{paciente.nacimiento}</Texto></View>
          </View>
        </View>
        <View style={estilos.linea} />
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
          <Avatar nombre={paciente.propietario} fotoPath={paciente.fotoDueno} tamano={34} />
          <Texto variante="cuerpo" tamano={13.5} color={Colores.white} style={{ flex: 1, marginLeft: 10 }}>{`Propietario: ${paciente.propietario}`}</Texto>
        </View>
        <Texto variante="cuerpo" tamano={13.5} color={Colores.white} style={{ marginTop: 6 }}>{`Contacto: ${paciente.telefono}`}</Texto>
      </View>

      <View style={estilos.pestanas} accessibilityRole="tablist">
        {PESTANAS.map((t, i) => <Pestana key={t} texto={t} activa={pestana === i} alTocar={() => setPestana(i)} />)}
      </View>

      <View style={pestana === 0 ? null : estilos.oculta}>
        <InformeVet paciente={paciente} turnoId={turnoId} alTerminar={cerrarPantalla} />
      </View>
      <View style={pestana === 1 ? null : estilos.oculta}><InformacionVet paciente={paciente} /></View>
      <View style={pestana === 2 ? null : estilos.oculta}><HistorialPacienteVet paciente={paciente} /></View>
      <View style={pestana === 3 ? null : estilos.oculta}><ArchivosVet paciente={paciente} enTurno={turnoId !== null} /></View>
      <View style={{ height: 12 }} />

      <HojaInferior visible={menu} alCerrar={() => setMenu(false)}>
        <FilaMenu
          texto="Llamar al propietario" icono="telefono"
          alTocar={elegir(() => Contacto.abrir("tel:" + paciente.telefono.replace(/[^\d+]/g, ""), "No hay un teléfono cargado para este dueño"))}
        />
        <FilaMenu texto="Enviar correo al propietario" icono="correo" alTocar={elegir(() => Contacto.abrir(Contacto.correo(paciente.email), "No hay un correo cargado para este dueño"))} />
        <FilaMenu
          texto="Escribir por WhatsApp" icono="whatsapp"
          alTocar={elegir(() =>
            Contacto.abrir(Contacto.whatsApp(paciente.telefono, Contacto.mensajeDeSaludo(paciente.propietario, paciente.nombre)), "No hay un teléfono válido para este dueño"),
          )}
        />
        <FilaMenu texto="Certificado de vacunación (PDF)" icono="pdf" alTocar={elegir(() => generarCertificado(true))} />
        <FilaMenu texto="Certificado de salud (PDF)" icono="pdf" alTocar={elegir(() => generarCertificado(false))} />
        {/* Sin cuenta, el dueño no ve nada de lo que se completa acá: se la puede crear el veterinario */}
        {!actual.tieneCuenta ? (
          <FilaMenu
            texto="Crear cuenta del dueño" icono="personas"
            alTocar={elegir(() => {
              // También pasan al dueño los otros pacientes del mismo propietario que no tienen cuenta
              const mismos = PacientesRepo.mismoPropietarioSinCuenta(actual).map((p) => p.id);
              const ids = mismos.length > 0 ? mismos : [paciente.id];
              router.push({ pathname: "/vet/dueno-nuevo", params: { pacientes: ids.join(",") } });
            })}
          />
        ) : null}
        <FilaMenu texto="Recordatorios del paciente" icono="notificacion" alTocar={elegir(() => setRecordatorios(true))} />
        <Boton titulo="Cerrar" variante="texto" alto={48} estilo={{ marginTop: 4 }} onPress={() => setMenu(false)} />
      </HojaInferior>

      <RecordatoriosPaciente visible={recordatorios} paciente={actual} alCerrar={() => setRecordatorios(false)} />
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  hero: { backgroundColor: Colores.primaryTeal, borderRadius: 24, padding: 16 },
  chip: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  linea: { height: 1, marginTop: 14, backgroundColor: "rgba(255,255,255,0.2)" },
  pestanas: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  pestana: { paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: "transparent" },
  pestanaActiva: { borderBottomColor: Colores.primaryTeal },
  oculta: { display: "none" },
  opcion: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: 8, borderRadius: 12 },
});
