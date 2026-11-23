import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Escenario } from "../../soporte/fuenteEnMemoria";
import { AgendaRepo } from "../../../src/data/repositorio/agendaRepo";
import { PacientesRepo } from "../../../src/data/repositorio/pacientesRepo";
import { SaludRepo } from "../../../src/data/repositorio/saludRepo";
import { Avisos } from "../../../src/ui/common/Avisos";
import DetallePacientePantalla from "../../../src/ui/veterinario/DetallePacientePantalla";
import { leerSignos } from "../../../src/ui/veterinario/InformeVet";
import { entrarComoVeterinario, fijarHoy, liberarHoy } from "./escenarioDetalleVet";

beforeEach(async () => {
  fijarHoy();
  const servidor = prepararServicios();
  fijarRuta({ id: "m1" });
  Avisos.reiniciar();
  await entrarComoVeterinario(servidor);
});
afterEach(() => {
  liberarHoy();
  limpiarServicios();
  Avisos.reiniciar();
});

const escribir = (etiqueta: string, texto: string) => fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
const conTurno = () => fijarRuta({ id: "m1", evento: "t1" });

describe("DetallePacientePantalla: ficha", () => {
  it("muestra los datos del paciente y las cuatro pestañas", async () => {
    fijarRuta({ id: "m2" });
    await render(<DetallePacientePantalla />);
    expect(screen.getByText("Ficha del paciente")).toBeTruthy();
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.getByText("Mestizo - Macho")).toBeTruthy();
    for (const t of ["Informe", "Información", "Historial clínico", "Archivos"]) expect(screen.getByRole("tab", { name: t })).toBeTruthy();
  });

  it("un paciente inexistente avisa y cierra la pantalla", async () => {
    fijarRuta({ id: "no-existe" });
    await render(<DetallePacientePantalla />);
    expect(Avisos.estado.banner?.mensaje).toBe("No se encontró la mascota");
    expect(enrutador.back).toHaveBeenCalled();
  });

  it("la pestaña Información muestra los datos clínicos y del propietario", async () => {
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByRole("tab", { name: "Información" }));
    expect(screen.getByText("Datos clínicos")).toBeTruthy();
    expect(screen.getByText("12 kg")).toBeTruthy();
    expect(screen.getByText("Propietario", { exact: true })).toBeTruthy();
    expect(screen.getByText("Alertas clínicas: ninguna cargada")).toBeTruthy();
  });

  it("las alertas clínicas se editan y se guardan", async () => {
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByRole("tab", { name: "Información" }));
    await fireEvent.press(screen.getByLabelText("Agregar alertas"));
    expect(screen.getByText("Alertas de Rex")).toBeTruthy();
    await escribir("Alertas de Rex", "Alérgico a la penicilina");
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(PacientesRepo.porId("m1")?.alertas).toBe("Alérgico a la penicilina");
    expect(Avisos.estado.banner?.mensaje).toBe("Alertas guardadas");
  });

  it("el historial clínico lista los turnos y abre el detalle", async () => {
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByRole("tab", { name: "Historial clínico" }));
    expect(screen.getByText("Eventos clínicos")).toBeTruthy();
    const filas = screen.getAllByRole("button", { name: /^Control, / });
    expect(filas).toHaveLength(2);
    await fireEvent.press(filas[0]);
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/evento/[id]", params: { id: "t1" } });
  });

  it("la pestaña Archivos sin archivos muestra el estado vacío y permite subir", async () => {
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByRole("tab", { name: "Archivos" }));
    expect(screen.getByText("Sin archivos")).toBeTruthy();
    expect(screen.getByText("Subí estudios, recetas o documentos del paciente")).toBeTruthy();
    expect(screen.getByText("Subir archivo")).toBeTruthy();
  });

  it("durante un turno los archivos se adjuntan desde el informe (no hay botón de subir)", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByRole("tab", { name: "Archivos" }));
    expect(screen.getByText("Adjuntá archivos desde la pestaña Informe para que queden en esta consulta")).toBeTruthy();
    expect(screen.queryByText("Subir archivo")).toBeNull();
  });

  it("la pestaña Archivos lista los de la mascota y ofrece abrir, renombrar y eliminar", async () => {
    fuente().archivos.push({ id: "a1", mascota_id: "m1", nombre: "Radiografía", extension: "pdf", storage_path: "m1/a1.pdf", created_at: new Date().toISOString() });
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByRole("tab", { name: "Archivos" }));
    await fireEvent.press(await screen.findByLabelText(/^Radiografía\./));
    expect(screen.getByText("Abrir / Visualizar")).toBeTruthy();
    expect(screen.getByText("Cambiar nombre")).toBeTruthy();
    expect(screen.getByText("Eliminar archivo")).toBeTruthy();
    await fireEvent.press(screen.getByText("Eliminar archivo"));
    expect(Avisos.estado.carteles[0].titulo).toBe("¿Eliminar el archivo?");
  });

  it("el menú ofrece contactar al dueño, certificados, crear la cuenta y recordatorios", async () => {
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByLabelText("Más opciones del paciente"));
    for (const t of [
      "Llamar al propietario", "Enviar correo al propietario", "Escribir por WhatsApp", "Certificado de vacunación (PDF)",
      "Certificado de salud (PDF)", "Recordatorios del paciente",
    ]) expect(screen.getByText(t)).toBeTruthy();
    // El dueño de Rex ya tiene cuenta
    expect(screen.queryByText("Crear cuenta del dueño")).toBeNull();
  });

  it("un paciente sin cuenta ofrece crearle la cuenta al dueño", async () => {
    const toby = PacientesRepo.agregarManual("Toby", "Perro", "", "Macho", "Carlos Gómez", "1144443333", "", "30111999");
    fijarRuta({ id: toby.id });
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByLabelText("Más opciones del paciente"));
    await fireEvent.press(screen.getByText("Crear cuenta del dueño"));
    expect(enrutador.push).toHaveBeenCalledWith({ pathname: "/vet/dueno-nuevo", params: { pacientes: toby.id } });
  });

  it("los recordatorios del paciente se abren desde el menú", async () => {
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByLabelText("Más opciones del paciente"));
    await fireEvent.press(screen.getByText("Recordatorios del paciente"));
    expect(screen.getByText("Recordatorios de Rex")).toBeTruthy();
    expect(screen.getByText("Todavía no dejaste recordatorios para Rex. El dueño recibe un aviso cuando creás uno.")).toBeTruthy();
  });
});

describe("DetallePacientePantalla: informe", () => {
  it("guardar el informe de un turno pendiente ofrece completarlo", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    await escribir("Diagnóstico", "Otitis");
    await escribir("Tratamiento y recomendaciones", "Gotas por 7 días");
    await fireEvent.press(screen.getByText("Guardar informe"));
    await act(async () => {});

    expect(fuente().llamadas).toContain("crearInforme:m1");
    expect(fuente().turnosGuardados.find((t) => t.id === "t1")?.estado).toBe("pendiente");
    const cartel = Avisos.estado.carteles[0];
    expect(cartel.titulo).toBe("Informe guardado");
    expect(cartel.textoAceptar).toBe("Completar turno");
    await act(async () => {
      Avisos.cerrarCartel(cartel.id, true);
    });
    expect(AgendaRepo.porId("t1")?.estado).toBe("COMPLETADO");
    expect(fuente().turnosGuardados.find((t) => t.id === "t1")?.estado).toBe("completado");
    expect(enrutador.back).toHaveBeenCalled();
  });

  it("el informe vacío no se guarda", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByText("Guardar informe"));
    expect(Avisos.estado.banner?.mensaje).toBe("Completá al menos la anamnesis, los signos vitales, el diagnóstico o el tratamiento");
    expect(fuente().llamadas.some((l) => l.startsWith("crearInforme"))).toBe(false);
  });

  it("guarda los signos vitales aunque no haya diagnóstico", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    await escribir("Peso (kg)", "12,5");
    await escribir("Temperatura (°C)", "38,5");
    await escribir("Anamnesis", "Come menos");
    await fireEvent.press(screen.getByText("Guardar informe"));
    await act(async () => {});
    const creado = fuente().ultimoInformeCreado!;
    expect(creado.peso_kg).toBeCloseTo(12.5);
    expect(creado.temperatura_c).toBeCloseTo(38.5);
    expect(creado.anamnesis).toBe("Come menos");
  });

  it("no guarda una temperatura imposible", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    await escribir("Temperatura (°C)", "60");
    await escribir("Diagnóstico", "Otitis");
    await fireEvent.press(screen.getByText("Guardar informe"));
    expect(Avisos.estado.banner?.mensaje).toBe("La temperatura tiene que estar entre 25 y 45 °C");
    expect(fuente().llamadas.some((l) => l.startsWith("crearInforme"))).toBe(false);
  });

  it("parte del motivo del turno", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    expect(screen.getByDisplayValue("Control")).toBeTruthy();
  });

  it("un informe de otro día se puede leer pero no modificar", async () => {
    fuente().informes.push({
      id: "i1", mascota_id: "m1", turno_id: "t3", veterinario_id: Escenario.VET_ID, motivo: "Control", diagnostico: "Sano",
      tratamiento: "Nada", created_at: "2026-11-03T12:00:00+00:00",
    });
    fijarRuta({ id: "m1", evento: "t3" });
    await render(<DetallePacientePantalla />);
    expect(await screen.findByText("Este informe ya está cerrado: solo lo puede modificar quien lo hizo y el mismo día en que se hizo.")).toBeTruthy();
    expect(screen.queryByText("Guardar informe")).toBeNull();
  });

  it("sin turno no lista los archivos ya cargados de la mascota", async () => {
    fuente().archivos.push({ id: "a1", mascota_id: "m1", nombre: "Radiografía", extension: "pdf", storage_path: "m1/a1.pdf", created_at: new Date().toISOString() });
    await render(<DetallePacientePantalla />);
    await act(async () => {});
    expect(screen.getByText("Todavía no adjuntaste archivos a esta consulta.")).toBeTruthy();
  });

  it("se puede recetar un medicamento y aparece el botón de la receta en PDF", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    expect(screen.queryByText("Receta en PDF")).toBeNull();
    expect(screen.getByText("Todavía no recetaste ningún medicamento en esta consulta.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Agregar medicamento"));
    expect(screen.getByText("Agregar a la receta")).toBeTruthy();
    await escribir("Medicamento", "Amoxicilina");
    await escribir("Dosis", "250 mg");
    await escribir("Cada (horas)", "8");
    await escribir("Durante (días)", "7");
    await fireEvent.press(screen.getByText("Agregar a la receta"));
    await act(async () => {});

    expect(fuente().llamadas).toContain("crearPrescripcion:Amoxicilina");
    expect(screen.getByText("Receta en PDF")).toBeTruthy();
    expect(screen.getByText("250 mg, cada 8 hs, durante 7 días")).toBeTruthy();
  });

  it("el medicamento exige un nombre y valores de horas y días posibles", async () => {
    conTurno();
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByText("Agregar medicamento"));
    await fireEvent.press(screen.getByText("Agregar a la receta"));
    expect(screen.getByText("Indicá el medicamento")).toBeTruthy();
    await escribir("Medicamento", "Amoxicilina");
    await escribir("Cada (horas)", "500");
    await fireEvent.press(screen.getByText("Agregar a la receta"));
    expect(screen.getAllByText("Revisá las horas (1 a 168) y los días (1 a 365)").length).toBeGreaterThan(0);
    expect(fuente().llamadas.some((l) => l.startsWith("crearPrescripcion"))).toBe(false);
  });

  it("la vacuna aplicada en la consulta queda en el carnet", async () => {
    await render(<DetallePacientePantalla />);
    expect(screen.getByText("Si vacunás en esta consulta, registrala acá: queda en el carnet de salud del animal.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Registrar vacuna"));
    expect(screen.getByText("Registrar vacuna aplicada")).toBeTruthy();
    expect(screen.getByText("Rex · 23 Nov 2026")).toBeTruthy();
    await escribir("Vacuna", "Antirrábica");
    await escribir("Marca / producto", "Nobivac");
    await escribir("Lote", "A123");
    await fireEvent.press(screen.getByText("Guardar en el carnet"));
    await act(async () => {});

    const creada = fuente().ultimoRegistroCreado!;
    expect(creada.tipo).toBe("vacuna");
    expect(creada.titulo).toBe("Antirrábica");
    expect(creada.marca).toBe("Nobivac");
    expect(creada.lote).toBe("A123");
    expect(creada.fecha).toBe("2026-11-23");
    expect(SaludRepo.filtrar("VACUNA", "", "m1").some((r) => r.titulo === "Antirrábica")).toBe(true);
    expect(Avisos.estado.banner?.mensaje).toBe("Vacuna guardada en el carnet de Rex");
  });

  it("la vacuna exige el nombre", async () => {
    await render(<DetallePacientePantalla />);
    await fireEvent.press(screen.getByText("Registrar vacuna"));
    await fireEvent.press(screen.getByText("Guardar en el carnet"));
    expect(screen.getByText("Indicá la vacuna")).toBeTruthy();
    expect(fuente().ultimoRegistroCreado).toBeNull();
  });
});

describe("leerSignos", () => {
  it("acepta coma decimal y valores vacíos", () => {
    expect(leerSignos("12,4", "", "", "")).toEqual({ signos: { pesoKg: 12.4, temperaturaC: null, frecuenciaCardiaca: null, frecuenciaRespiratoria: null } });
  });
  it("rechaza lo que está fuera de rango con los textos del Kotlin", () => {
    expect(leerSignos("0", "", "", "")).toEqual({ problema: "El peso tiene que estar entre 0 y 999 kg" });
    expect(leerSignos("", "", "500", "")).toEqual({ problema: "La frecuencia cardíaca tiene que estar entre 10 y 400 lpm" });
    expect(leerSignos("", "", "", "1")).toEqual({ problema: "La frecuencia respiratoria tiene que estar entre 2 y 200 rpm" });
    expect(leerSignos("abc", "", "", "")).toEqual({ problema: "El peso tiene que estar entre 0 y 999 kg" });
  });
});
