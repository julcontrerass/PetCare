/*
 * Migrado de ui/veterinario/InformacionVetFragment.kt (fragment_informacion_vet.xml). Pestaña "Información": alertas
 * clínicas (editables), evolución del peso, datos clínicos y datos del propietario.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { InformesRepo } from "../../data/repositorio/informesRepo";
import { PacientesRepo, type Paciente } from "../../data/repositorio/pacientesRepo";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { DialogoCentral } from "../common/DialogoCentral";
import { AlertasClinicas, EvolucionPeso } from "../common/FichaClinica";
import type { PuntoPeso } from "../common/GraficoPesoView";
import { Texto } from "../common/Texto";
import { useDatos } from "../common/useDatos";
import { FilaInfo, SeccionTitulo } from "./ElementosVet";

export function InformacionVet({ paciente }: { paciente: Paciente }) {
  useDatos();
  const p = PacientesRepo.porId(paciente.id) ?? paciente;
  const [pesos, setPesos] = useState<PuntoPeso[]>([]);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");

  // Alertas y evolución del peso van arriba de los datos clínicos
  useEffect(() => {
    let vigente = true;
    InformesRepo.pesos(paciente.id).then((x) => vigente && setPesos(x)).catch(() => {});
    return () => {
      vigente = false;
    };
  }, [paciente.id]);

  const guardar = () => {
    PacientesRepo.guardarAlertas(p.id, texto);
    setEditando(false);
    Avisos.exito("Alertas guardadas");
  };

  return (
    <View>
      <AlertasClinicas texto={p.alertas} alEditar={() => { setTexto(p.alertas); setEditando(true); }} estilo={{ marginBottom: 12 }} />
      <EvolucionPeso puntos={pesos} estilo={{ marginBottom: 12 }} />

      <SeccionTitulo texto="Datos clínicos" estilo={{ marginTop: 0 }} />
      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 14, marginTop: 10 }}>
        <FilaInfo icono="peso" etiqueta="Peso" valor={p.peso} />
        <FilaInfo icono="chip" etiqueta="Microchip" valor={p.microchip} />
        <FilaInfo icono="perro" etiqueta="Color" valor={p.color} />
        <FilaInfo icono="documento" etiqueta="Observaciones" valor={p.observaciones} conDivisor={false} />
      </View>

      <SeccionTitulo texto="Propietario" estilo={{ marginTop: 18 }} />
      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 14, marginTop: 10 }}>
        <FilaInfo
          icono="persona" etiqueta="Nombre completo" valor={p.propietario}
          izquierda={p.fotoDueno ? <Avatar nombre={p.propietario} fotoPath={p.fotoDueno} tamano={38} /> : undefined}
        />
        <FilaInfo icono="ubicacion" etiqueta="Dirección" valor={p.direccion} />
        <FilaInfo icono="telefono" etiqueta="Teléfono de contacto" valor={p.telefono} />
        <FilaInfo icono="correo" etiqueta="Email" valor={p.email} conDivisor={false} />
      </View>

      <DialogoCentral visible={editando} alCerrar={() => setEditando(false)}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header">{`Alertas de ${p.nombre}`}</Texto>
        <Campo
          multilinea placeholder="Ej: Alérgico a la penicilina. Nervioso con otros perros." accessibilityLabel={`Alertas de ${p.nombre}`}
          value={texto} onChangeText={setTexto} autoCapitalize="sentences" numberOfLines={3} estilo={{ marginTop: 12 }}
        />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
          <Boton titulo="Cancelar" variante="texto" alto={44} estilo={{ alignSelf: "auto", minWidth: 100 }} onPress={() => setEditando(false)} />
          <Boton titulo="Guardar" variante="texto" alto={44} estilo={{ alignSelf: "auto", minWidth: 100 }} onPress={guardar} />
        </View>
      </DialogoCentral>
    </View>
  );
}
