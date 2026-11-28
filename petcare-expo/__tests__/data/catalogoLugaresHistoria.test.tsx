/* Catálogo de servicios del administrador, servicios por lugar e historia clínica en PDF. */
jest.mock("@expo/vector-icons", () => require("../ui/iconosFalsos"));
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { CatalogoMedico, type ItemCatalogo } from "../../src/data/catalogoMedico";
import { historiaDelDueno, historiaDelVeterinario, historiaVacia } from "../../src/data/historiaClinica";
import { CatalogoRepo } from "../../src/data/repositorio/catalogoRepo";
import { DuenoRepo } from "../../src/data/repositorio/duenoRepo";
import { PerfilVetRepo } from "../../src/data/repositorio/perfilVetRepo";
import { crearInformeData } from "../../src/data/repositorio/informesRepo";
import { crearPrescripcion } from "../../src/model/clinica";
import { crearSede, EventoMascota, ofreceEn, textoServiciosSede, type VeterinarioAcceso } from "../../src/model/modelos";
import { LocalDate, LocalDateTime } from "../../src/util/tiempo";
import { PanelServicios } from "../../src/ui/admin/PanelServicios";
import { Avisos } from "../../src/ui/common/Avisos";
import { crearDatosPaciente, crearProfesional, planoDeHistoriaClinica } from "../../src/ui/common/Documentos";
import { Escenario, type FuenteEnMemoria } from "../soporte/fuenteEnMemoria";
import { ingresarComo, limpiarServicios, prepararServicios } from "../soporte/pruebaBase";

const ORIGINAL = { servicios: [...CatalogoMedico.SERVICIOS], especialidades: [...CatalogoMedico.ESPECIALIDADES] };
const item = (nombre: string, tipo: ItemCatalogo["tipo"], duracion_min = 30, activo = true): ItemCatalogo => ({ nombre, tipo, duracion_min, activo });
const CATALOGO: ItemCatalogo[] = [
  item("Chequeo médico integral", "servicio"),
  item("Cirugía 24hs", "servicio", 120),
  item("Baño y peluquería", "servicio", 60, false),
  item("Cardiología", "especialidad", 45),
  item("Odontología", "especialidad", 60),
];

let fuente: FuenteEnMemoria;
beforeEach(() => {
  fuente = prepararServicios();
  Avisos.reiniciar();
});
afterEach(() => {
  // El catálogo es global: se vuelve a la lista de siempre
  CatalogoMedico.SERVICIOS.splice(0, CatalogoMedico.SERVICIOS.length, ...ORIGINAL.servicios);
  CatalogoMedico.ESPECIALIDADES.splice(0, CatalogoMedico.ESPECIALIDADES.length, ...ORIGINAL.especialidades);
  CatalogoMedico.INACTIVOS = new Set();
  CatalogoMedico.ITEMS = [];
  CatalogoMedico.TODAS_LAS_ESPECIALIDADES = [];
  limpiarServicios();
});

describe("catálogo de servicios", () => {
  it("se baja de la base: lo desactivado no se elige ni se ofrece, y las duraciones salen de ahí", async () => {
    fuente.catalogo = CATALOGO.map((i) => ({ ...i }));
    await CatalogoRepo.cargar();
    expect(CatalogoMedico.SERVICIOS).toEqual(["Chequeo médico integral", "Cirugía 24hs"]);
    expect(CatalogoMedico.ESPECIALIDADES).toEqual(["Cardiología", "Odontología"]);
    expect(CatalogoMedico.duracionPorDefecto("Odontología")).toBe(60);
    expect(CatalogoMedico.pideTitulo("Odontología")).toBe(true);
    // Un veterinario que tenía "Baño y peluquería" ya no lo ofrece; la especialidad sin título tampoco
    expect(CatalogoMedico.ofrecidas(["Baño y peluquería", "Cirugía 24hs", "Cardiología"], [])).toEqual(["Cirugía 24hs"]);
  });

  it("sin catálogo en la base queda la lista de siempre", async () => {
    await CatalogoRepo.cargar();
    expect(CatalogoMedico.SERVICIOS).toEqual(ORIGINAL.servicios);
  });

  it("el perfil del veterinario conserva lo que ya tenía elegido aunque se haya desactivado", async () => {
    PerfilVetRepo.sincronizarCatalogo(["Baño y peluquería", "Cardiología"]);
    fuente.catalogo = CATALOGO.map((i) => ({ ...i }));
    await CatalogoRepo.cargar();
    expect(PerfilVetRepo.todasLasEspecialidades).toEqual([
      "Chequeo médico integral", "Cirugía 24hs", "Cardiología", "Odontología", "Baño y peluquería",
    ]);
    expect(PerfilVetRepo.serviciosOfrecidos()).toEqual(["Cardiología", "Baño y peluquería"]);
  });

  it("el administrador agrega una especialidad y desactiva un servicio", async () => {
    fuente.catalogo = CATALOGO.map((i) => ({ ...i }));
    await ingresarComo(Escenario.admin());
    await CatalogoRepo.cargar();
    await render(<PanelServicios estiloPanel={{}} />);
    expect(screen.getByText("2 servicios y 2 especialidades activos")).toBeTruthy();

    await fireEvent.press(screen.getByText("Agregar"));
    await fireEvent.changeText(screen.getByPlaceholderText("Ej: Odontología"), "Etología");
    await fireEvent.press(screen.getByText("Especialidad (pide título)"));
    await fireEvent.press(screen.getByText("1 h"));
    await act(async () => {
      fireEvent.press(screen.getAllByRole("button", { name: "Agregar" }).at(-1)!);
    });
    expect(fuente.llamadas).toContain("guardarServicioCatalogo:Etología:especialidad:60:true");
    expect(CatalogoMedico.ESPECIALIDADES).toContain("Etología");

    await fireEvent.press(screen.getByLabelText("Cirugía 24hs"));
    await fireEvent.press(screen.getAllByText("Desactivado").at(-1)!);
    expect(screen.getByText(/No se va a poder elegir ni sacar turnos para esto/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText("Guardar"));
    });
    expect(fuente.llamadas).toContain("guardarServicioCatalogo:Cirugía 24hs:servicio:120:false");
    expect(CatalogoMedico.SERVICIOS).toEqual(["Chequeo médico integral"]);
  });
});

describe("servicios por lugar", () => {
  const delCatalogo = (n: string) => CatalogoMedico.esDelCatalogo(n);
  const quirofano = crearSede({ id: "s1", nombre: "Clínica Sur", servicios: ["Cirugía 24hs"] });
  const consultorio = crearSede({ id: "s2", nombre: "Consultorio" });

  it("un lugar con lista solo atiende eso; los tipos generales valen en todos lados", () => {
    expect(ofreceEn(quirofano, "Cirugía 24hs", delCatalogo)).toBe(true);
    expect(ofreceEn(quirofano, "Cardiología", delCatalogo)).toBe(false);
    expect(ofreceEn(quirofano, "Consulta", delCatalogo)).toBe(true);
    expect(ofreceEn(consultorio, "Cardiología", delCatalogo)).toBe(true);
    expect(textoServiciosSede(quirofano)).toBe("Solo: Cirugía 24hs");
    expect(textoServiciosSede(consultorio)).toBe("");
  });

  it("al sacar un turno se ofrecen solo los lugares que atienden ese servicio", () => {
    const vet = { sedes: [consultorio, quirofano] } as unknown as VeterinarioAcceso;
    expect(DuenoRepo.lugaresPara(vet, "Cirugía 24hs").map((s) => s.nombre)).toEqual(["Consultorio", "Clínica Sur"]);
    expect(DuenoRepo.lugaresPara(vet, "Cardiología").map((s) => s.nombre)).toEqual(["Consultorio"]);
    const soloQuirofano = { sedes: [quirofano] } as unknown as VeterinarioAcceso;
    expect(DuenoRepo.lugaresPara(soloQuirofano, "Cardiología")).toEqual([]);
  });
});

describe("historia clínica en PDF", () => {
  const receta = crearPrescripcion({
    id: "r", mascotaId: "m1", medicamento: "Amoxicilina", dosis: "250 mg", frecuenciaHoras: 12, duracionDias: 7,
    inicio: LocalDate.of(2026, 11, 2), creada: LocalDateTime.of(2026, 11, 2, 10, 0),
  });
  const paciente = crearDatosPaciente({ nombre: "Rex", especie: "Perro", propietario: "Ana Prueba" });

  it("el veterinario la arma con los informes de cada consulta y la firma", () => {
    const informe = { ...crearInformeData("m1", { turnoId: "t1" }), diagnostico: "Otitis externa", tratamiento: "Limpieza y gotas" };
    const h = historiaDelVeterinario([], [receta], [
      { fecha: LocalDate.of(2026, 11, 2), tipo: "Consulta", motivo: "Se rasca la oreja", veterinario: "Dr. Vera", informe },
    ]);
    expect(historiaVacia(h)).toBe(false);
    const texto = planoDeHistoriaClinica(crearProfesional({ nombre: "Dr. Vera", matricula: "MP-1" }), paciente, LocalDate.of(2026, 11, 28), h).texto();
    expect(texto).toContain("HISTORIA CLÍNICA");
    expect(texto).toContain("Consulta");
    expect(texto).toContain("Motivo: Se rasca la oreja");
    expect(texto).toContain("Diagnóstico: Otitis externa");
    expect(texto).toContain("Amoxicilina 250 mg");
    expect(texto).toContain("Sin vacunas registradas.");
    expect(texto).toContain("Matrícula MP-1");
  });

  it("el dueño la arma con los turnos completados, sin firma", () => {
    const completado = new EventoMascota("Vacunación", "Rex", "Dra. Paz", "10:00", "Todo bien", LocalDate.of(2026, 10, 1), { id: "e1", mascotaId: "m1", estado: "COMPLETADO" });
    const pendiente = new EventoMascota("Control", "Rex", "Dra. Paz", "10:00", "", LocalDate.of(2026, 12, 1), { id: "e2", mascotaId: "m1", estado: "PENDIENTE" });
    const h = historiaDelDueno([], [], [completado, pendiente]);
    expect(h.consultas.map((c) => c.titulo)).toEqual(["Vacunación"]);
    const texto = planoDeHistoriaClinica(null, paciente, LocalDate.of(2026, 11, 28), h).texto();
    expect(texto).toContain("Atendió: Dra. Paz");
    expect(texto).toContain("Resumen generado por Ana Prueba desde PetCare");
    expect(texto).not.toContain("Matrícula");
  });
});
