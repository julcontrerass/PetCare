/*
 * Migrado de ui/veterinario/VacunasPendientesActivity.kt + VacunasPendientesAdapter (activity_vacunas_pendientes.xml,
 * item_vacuna_pendiente.xml). Pacientes a los que hay que avisarles que les toca (o se les pasó) una vacuna: las dosis
 * vencidas y las que vencen en los próximos 30 días, con atajos para escribirle o llamar al dueño.
 * Ruta: `/vet/vacunas-pendientes`.
 */
import { View } from "react-native";
import { PacientesRepo } from "../../data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { SaludRepo, TiposRegistro, type RegistroSalud } from "../../data/repositorio/saludRepo";
import { diasEntre, LocalDate } from "../../util/tiempo";
import { Avatar } from "../common/Avatar";
import { Boton } from "../common/Boton";
import { Chip, type TonoChip } from "../common/Chip";
import { Contacto } from "../common/Contacto";
import { EstadoVacio } from "../common/EstadoVacio";
import { PantallaBase } from "../common/PantallaBase";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useActualizarDatosVeterinario } from "../common/useActualizarDatosVeterinario";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { cerrarPantalla } from "./estadoVet";

/** "Vencida hace 3 d" / "Vence hoy" / "En 5 d" según los días que faltan. */
export function estadoDeDosis(proxima: LocalDate | null, hoy: LocalDate = LocalDate.now()): { texto: string; tono: TonoChip } {
  const dias = proxima ? diasEntre(hoy, proxima) : 0;
  if (dias < 0) return { texto: `Vencida hace ${-dias} d`, tono: "peligro" };
  if (dias === 0) return { texto: "Vence hoy", tono: "aviso" };
  return { texto: `En ${dias} d`, tono: "aviso" };
}

export function textoCuenta(n: number): string {
  return n === 0 ? "Todo al día" : n === 1 ? "1 dosis para recordar" : `${n} dosis para recordar`;
}

type Canal = "WHATSAPP" | "LLAMAR";

function avisar(v: RegistroSalud, canal: Canal): void {
  const paciente = PacientesRepo.porId(v.mascotaId);
  const telefono = paciente?.telefono ?? "";
  if (canal === "LLAMAR") {
    void Contacto.abrir(Contacto.llamar(telefono), "No hay un teléfono cargado para este dueño");
    return;
  }
  const mensaje = Contacto.mensajeDeRevision(paciente?.propietario, PerfilVetRepo.clinica, v.mascota, TiposRegistro[v.tipo].singular, v.titulo, v.proximaDosis, LocalDate.now());
  void Contacto.abrir(Contacto.whatsApp(telefono, mensaje), "No hay un teléfono válido para este dueño");
}

function FilaVacuna({ v }: { v: RegistroSalud }) {
  const paciente = PacientesRepo.porId(v.mascotaId);
  const estado = estadoDeDosis(v.proximaDosis);
  return (
    <Tarjeta relleno={14} estilo={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Avatar nombre={paciente?.propietario} fotoPath={PacientesRepo.fotoDuenoDe(v.mascotaId)} tamano={44} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Texto variante="titulo" tamano={16}>{v.mascota}</Texto>
          <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark}>{v.titulo}</Texto>
          <Texto variante="chico" tamano={12.5}>{`Dueño: ${paciente?.propietario ?? "Sin datos"} · ${paciente?.telefono ?? "Sin teléfono"}`}</Texto>
        </View>
        <Chip texto={estado.texto} tono={estado.tono} />
      </View>
      <View style={{ flexDirection: "row", marginTop: 12 }}>
        <Boton titulo="Avisar por WhatsApp" alto={44} estilo={{ flex: 1 }} onPress={() => avisar(v, "WHATSAPP")} />
        <Boton titulo="Llamar" variante="secundario" alto={44} estilo={{ flex: 1, marginLeft: 6 }} onPress={() => avisar(v, "LLAMAR")} />
      </View>
    </Tarjeta>
  );
}

export default function VacunasPendientesPantalla() {
  useSesionRequerida();
  useDatos();
  useActualizarDatosVeterinario();
  const lista = SaludRepo.vacunasARecordar();
  return (
    <PantallaBase titulo="Vacunas a recordar" subtitulo={textoCuenta(lista.length)} alVolver={cerrarPantalla}>
      {lista.length === 0 ? (
        <EstadoVacio
          icono="vacuna" titulo="No hay dosis para recordar" estilo={{ marginTop: 16 }}
          mensaje="Acá aparecen las vacunas y desparasitaciones vencidas o que vencen en los próximos 30 días"
        />
      ) : (
        lista.map((v) => <FilaVacuna key={v.id} v={v} />)
      )}
    </PantallaBase>
  );
}
