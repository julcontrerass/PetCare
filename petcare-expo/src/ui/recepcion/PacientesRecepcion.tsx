/*
 * Pacientes de los veterinarios para los que trabaja la recepción: nombre, dueño y su contacto, alertas (alergias,
 * carácter) y los próximos turnos. Sin historia clínica: esa la ve solo el veterinario.
 */
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { RecepcionAgendaRepo, type PacienteRecepcion } from "../../data/repositorio/recepcionAgendaRepo";
import { Fechas } from "../../util/fechas";
import { Avatar } from "../common/Avatar";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { Contacto } from "../common/Contacto";
import { EstadoVacio } from "../common/EstadoVacio";
import { HojaInferior } from "../common/HojaInferior";
import { Icono } from "../common/Icono";
import { PantallaBase } from "../common/PantallaBase";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { useDatos } from "../common/useDatos";
import { FiltroVeterinarios, SinVeterinarios } from "./ElementosRecepcion";
import { NavRecepcion } from "./navegacionRecepcion";

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function FichaPaciente({ paciente: p, vetFiltro, alCerrar }: { paciente: PacienteRecepcion; vetFiltro: string | null; alCerrar: () => void }) {
  const vets = RecepcionAgendaRepo.veterinariosDe(p.id);
  const proximos = RecepcionAgendaRepo.proximos().filter((t) => t.mascotaId === p.id).slice(0, 3);
  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <View style={estilos.fila}>
        <Avatar nombre={p.nombre} fotoPath={p.fotoPath} tamano={56} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Texto variante="titulo" tamano={20} accessibilityRole="header">{p.nombre}</Texto>
          <Texto variante="chico" tamano={13}>{`${p.tipo} · ${p.dueno}`}</Texto>
        </View>
      </View>
      {p.alertas.trim() ? (
        <View style={estilos.alerta}>
          <Icono nombre="advertencia" tamano={18} color={Colores.accentOrangeDark} />
          <Texto variante="cuerpo" tamano={13.5} style={{ flex: 1, marginLeft: 8 }}>{p.alertas}</Texto>
        </View>
      ) : null}
      {vets.length > 0 ? (
        <Texto variante="chico" tamano={13} style={{ marginTop: 12 }}>{`Lo atiende: ${vets.map((v) => v.nombre).join(", ")}`}</Texto>
      ) : null}

      <Texto tamano={15} negrita style={{ marginTop: 16 }}>Próximos turnos</Texto>
      {proximos.length === 0 ? (
        <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>No tiene turnos agendados.</Texto>
      ) : (
        proximos.map((t) => (
          <Texto key={t.id} variante="cuerpo" tamano={14} style={{ marginTop: 4 }}>
            {`${Fechas.relativaConFecha(t.fecha)}, ${t.hora} · ${t.tipo}` +
              (RecepcionAgendaRepo.veterinarios.length > 1 ? ` · ${RecepcionAgendaRepo.veterinario(t.vetId)?.nombre ?? ""}` : "")}
          </Texto>
        ))
      )}

      {p.telefono ? (
        <View style={estilos.botones}>
          <Boton
            titulo="WhatsApp" icono="whatsapp" variante="secundario" alto={46} estilo={{ flex: 1 }}
            onPress={() => void Contacto.abrir(Contacto.whatsApp(p.telefono!, `Hola ${p.dueno.split(" ")[0]}, `), "No pudimos abrir WhatsApp")}
          />
          <Boton
            titulo="Llamar" icono="telefono" variante="secundario" alto={46} estilo={{ flex: 1 }}
            onPress={() => void Contacto.abrir(Contacto.llamar(p.telefono!), "No pudimos iniciar la llamada")}
          />
        </View>
      ) : null}
      <Boton
        titulo="Sacar turno" icono="calendarioMas" alto={50} estilo={{ marginTop: 14 }}
        onPress={() => { alCerrar(); NavRecepcion.nuevoTurno(vetFiltro ?? vets[0]?.id ?? null, p.id); }}
      />
    </HojaInferior>
  );
}

export function PacientesRecepcion() {
  useDatos();
  const [vet, setVet] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<PacienteRecepcion | null>(null);
  const q = normalizar(busqueda.trim());
  const pacientes = RecepcionAgendaRepo.pacientes(vet).filter(
    (p) => q === "" || normalizar(p.nombre).includes(q) || normalizar(p.dueno).includes(q),
  );
  const sinVets = RecepcionAgendaRepo.veterinarios.length === 0;

  return (
    <PantallaBase
      titulo="Pacientes" subtitulo={pacientes.length === 1 ? "1 paciente" : `${pacientes.length} pacientes`}
      alVolver={NavRecepcion.irAHoy} scroll={false} bordes={["top"]}
    >
      {sinVets ? (
        <SinVeterinarios />
      ) : (
        <>
          <FiltroVeterinarios elegido={vet} alElegir={setVet} />
          <Campo
            icono="buscar" placeholder="Buscar por mascota o dueño" accessibilityLabel="Buscar paciente" value={busqueda}
            onChangeText={setBusqueda} autoCapitalize="none" estilo={{ marginBottom: 12 }}
          />
          {pacientes.length === 0 ? (
            <EstadoVacio
              icono="perro" titulo={q ? "No encontramos pacientes" : "Todavía no hay pacientes"}
              mensaje={q ? "Probá con otro nombre." : "Aparecen cuando un dueño le da acceso al veterinario."}
            />
          ) : (
            <FlatList
              data={pacientes}
              keyExtractor={(p) => p.id}
              renderItem={({ item: p }) => (
                <Tarjeta onPress={() => setAbierto(p)} relleno={12} estilo={{ marginBottom: 10 }} accessibilityLabel={`${p.nombre}, de ${p.dueno}`}>
                  <View style={estilos.fila}>
                    <Avatar nombre={p.nombre} fotoPath={p.fotoPath} tamano={44} />
                    <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                      <View style={estilos.nombre}>
                        <Texto variante="cuerpo" tamano={16} negrita numberOfLines={1} style={{ flexShrink: 1 }}>{p.nombre}</Texto>
                        {p.alertas.trim() ? <Icono nombre="advertencia" tamano={16} color={Colores.accentOrangeDark} /> : null}
                      </View>
                      <Texto variante="chico" tamano={13} numberOfLines={1}>{`${p.tipo} · ${p.dueno}`}</Texto>
                    </View>
                    <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
                  </View>
                </Tarjeta>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          )}
        </>
      )}
      {abierto ? <FichaPaciente paciente={abierto} vetFiltro={vet} alCerrar={() => setAbierto(null)} /> : null}
    </PantallaBase>
  );
}

export default PacientesRecepcion;

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center" },
  nombre: { flexDirection: "row", alignItems: "center", gap: 6 },
  alerta: {
    flexDirection: "row", alignItems: "flex-start", marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: Colores.lightOrange,
  },
  botones: { flexDirection: "row", gap: 10, marginTop: 16 },
});
