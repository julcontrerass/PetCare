/* PerfilVetSeccion y EditorSede: PantallasTest.vet_elPerfil*, vet_cerrarSesionVuelveAlIngreso, vet_elPerfilOfreceEntrarComoDueno. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { fuente, ingresarComoVeterinario, limpiarServicios, prepararServicios, ingresarComo } from "../../soporte/pruebaBase";
import { Escenario } from "../../soporte/fuenteEnMemoria";
import { PerfilVet } from "../../../src/ui/veterinario/PerfilVet";
import { PerfilVetRepo } from "../../../src/data/repositorio/perfilVetRepo";
import { Sesion } from "../../../src/data/sesion";
import { Avisos } from "../../../src/ui/common/Avisos";
import { cargarEscenarioVet } from "./escenarioVet";

beforeEach(() => {
  prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
  cargarEscenarioVet(fuente());
});
afterEach(() => {
  limpiarServicios();
  Avisos.reiniciar();
});

const aceptarCartel = async (texto: string) => {
  await fireEvent.press(screen.getByText(texto));
  await act(async () => {});
};

describe("PerfilVet", () => {
  it("muestra los datos del veterinario", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    expect(screen.getByText("Dr. Vera")).toBeTruthy();
    expect(screen.getByText("Matrícula MP-100")).toBeTruthy();
    expect(screen.getByText("DNI")).toBeTruthy();
    expect(screen.getByText(/Perros/)).toBeTruthy();
    for (const t of ["Editar perfil profesional", "Cambiar contraseña", "Notificaciones", "Cerrar sesión", "Eliminar mi cuenta"]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  it("cada opción de la cuenta abre su diálogo o su cartel", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Editar perfil profesional"));
    expect(screen.getByPlaceholderText("Teléfono de Contacto")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancelar"));
    await fireEvent.press(screen.getByText("Cambiar contraseña"));
    expect(screen.getByPlaceholderText("Nueva contraseña")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancelar"));
    await fireEvent.press(screen.getByText("Notificaciones"));
    expect(screen.getByText("Recordatorios de turnos")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancelar"));
    await fireEvent.press(screen.getByText("Eliminar mi cuenta"));
    expect(Avisos.estado.carteles[0]?.titulo).toBe("¿Eliminar tu cuenta?");
  });

  it("editar el perfil valida lo requerido y guarda", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Editar perfil profesional"));
    await fireEvent.changeText(screen.getByPlaceholderText("Matrícula"), "  ");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("Requerido")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Matrícula"), "MP-200");
    await fireEvent.changeText(screen.getByPlaceholderText("Nombre y Apellido"), "Dra. Vera");
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(PerfilVetRepo.matricula).toBe("MP-200");
    expect(screen.getByText("Matrícula MP-200")).toBeTruthy();
    expect(fuente().llamadas.some((l) => l.startsWith("perfil:"))).toBe(true);
  });

  it("cambiar la contraseña valida y llama al servidor", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Cambiar contraseña"));
    await fireEvent.changeText(screen.getByPlaceholderText("Contraseña actual"), "123456");
    await fireEvent.changeText(screen.getByPlaceholderText("Nueva contraseña"), "123");
    await fireEvent.press(screen.getByText("Guardar"));
    expect(Avisos.estado.banner?.mensaje).toBe("La nueva contraseña debe tener al menos 6 caracteres");
    await fireEvent.changeText(screen.getByPlaceholderText("Nueva contraseña"), "nueva123");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirmar nueva contraseña"), "nueva123");
    await fireEvent.press(screen.getByText("Guardar"));
    await waitFor(() => expect(fuente().llamadas).toContain(`password:${PerfilVetRepo.email}`));
    expect(Avisos.estado.banner?.mensaje).toBe("Contraseña actualizada");
  });

  it("guarda las preferencias de notificaciones", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Notificaciones"));
    await fireEvent.press(screen.getByText("Recordatorios de turnos"));
    await fireEvent.press(screen.getByText("Guardar"));
    expect(PerfilVetRepo.preferencia("turnos")).toBe(false);
    expect(PerfilVetRepo.preferencia("solicitudes")).toBe(true);
    expect(Avisos.estado.banner?.mensaje).toBe("Preferencias guardadas");
  });

  it("elegir los animales que atiende exige al menos uno", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Animales que atiendo"));
    expect(screen.getByText("Animales que atendés")).toBeTruthy();
    for (const t of ["Perros", "Gatos", "Aves", "Reptiles", "Peces", "Roedores", "Otros"]) expect(screen.getByText(t)).toBeTruthy();
    for (const t of PerfilVetRepo.tiposAnimales) {
      const nombre = ({ Perro: "Perros", Gato: "Gatos", Ave: "Aves", Reptil: "Reptiles", Pez: "Peces", Roedor: "Roedores", Otro: "Otros" } as Record<string, string>)[t];
      await fireEvent.press(screen.getByRole("checkbox", { name: nombre }));
    }
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("Elegí al menos un tipo de animal")).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Gatos" }));
    await fireEvent.press(screen.getByText("Guardar"));
    expect([...PerfilVetRepo.tiposAnimales]).toEqual(["Gato"]);
    expect(fuente().llamadas).toContain("veterinario:tipos_animales");
  });

  it("la duración de los turnos se ajusta de a 15 minutos y se guarda", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    const servicios = PerfilVetRepo.serviciosOfrecidos();
    expect(servicios.length).toBeGreaterThan(0);
    const antes = PerfilVetRepo.duracionDe(servicios[0]);
    await fireEvent.press(screen.getByText("Duración de los turnos"));
    await fireEvent.press(screen.getByLabelText(`Más tiempo para ${servicios[0]}`));
    await fireEvent.press(screen.getByText("Guardar"));
    expect(PerfilVetRepo.duracionDe(servicios[0])).toBe(antes + 15);
    expect(fuente().llamadas).toContain("veterinario:duraciones");
  });

  it("sin especialidades la duración avisa que primero hay que elegirlas", async () => {
    await ingresarComoVeterinario();
    PerfilVetRepo.especialidadesSeleccionadas.fill(false);
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Primero elegí tus especialidades y prácticas"));
    expect(Avisos.estado.banner?.mensaje).toBe("Primero elegí tus especialidades y prácticas");
  });

  it("cerrar sesión pide confirmación y vuelve al ingreso", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Cerrar sesión"));
    expect(Avisos.estado.carteles[0]?.titulo).toBe("¿Cerrar sesión?");
    Avisos.cerrarCartel(Avisos.estado.carteles[0].id, true);
    await act(async () => {});
    expect(Sesion.activa).toBe(false);
  });

  it("ofrece pasar al modo dueño", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Pasar al modo dueño de mascotas"));
    await act(async () => {});
    expect(Sesion.rol).toBe("DUENO");
    expect(enrutador.replace).toHaveBeenCalledWith("/dueno");
  });
});

describe("PerfilVet: lugares de atención", () => {
  it("muestra un lugar y permite agregar otro", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    expect(PerfilVetRepo.sedes).toHaveLength(1);
    await fireEvent.press(screen.getByText("Agregar otro lugar de atención"));
    expect(screen.getByText("Agregar otra veterinaria")).toBeTruthy();
    await fireEvent.press(screen.getByText("Guardar"));
    expect(screen.getByText("Ingresá el nombre de la veterinaria")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Ej: Veterinaria Central"), "Clínica Norte");
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(PerfilVetRepo.sedes.map((s) => s.nombre)).toContain("Clínica Norte");
    expect(fuente().llamadas).toContain("crearSede:Clínica Norte");
    expect(screen.getByText(/\(principal\)/)).toBeTruthy();
  });

  it("el horario de cierre tiene que ser posterior al de apertura", async () => {
    await ingresarComoVeterinario();
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Agregar otro lugar de atención"));
    await fireEvent.press(screen.getByRole("button", { name: "Desde: 09:00 hs" }));
    await fireEvent.press(screen.getAllByRole("button", { name: "20" })[0]);
    await fireEvent.press(screen.getByText("Aceptar"));
    expect(screen.getByText("El horario de cierre tiene que ser posterior al de apertura.")).toBeTruthy();
  });

  it("editar un lugar lo guarda; con dos lugares se puede eliminar", async () => {
    fuente().yo = Escenario.veterinarioEnDosLugares();
    await ingresarComo(Escenario.veterinarioEnDosLugares());
    await render(<PerfilVet />);
    expect(PerfilVetRepo.sedes).toHaveLength(2);
    expect(screen.getByText("Clínica Sur (principal)")).toBeTruthy();

    await fireEvent.press(screen.getByText("Consultorio Centro"));
    expect(screen.getByText("Editar veterinaria")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Ej: Veterinaria Central"), "Consultorio Plaza");
    await fireEvent.press(screen.getByText("Guardar"));
    await act(async () => {});
    expect(PerfilVetRepo.sedes[1].nombre).toBe("Consultorio Plaza");

    await fireEvent.press(screen.getByText("Consultorio Plaza"));
    await fireEvent.press(screen.getByText("Eliminar este lugar"));
    expect(Avisos.estado.carteles[0]?.titulo).toBe("¿Eliminar este lugar?");
    Avisos.cerrarCartel(Avisos.estado.carteles[0].id, true);
    await act(async () => {});
    expect(PerfilVetRepo.sedes).toHaveLength(1);
    expect(fuente().llamadas.some((l) => l.startsWith("eliminarSede:"))).toBe(true);
  });

  it("no deja eliminar un lugar con turnos pendientes", async () => {
    fuente().turnosGuardados.push({ ...Escenario.turno("t9", "m1", new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10), "10:00:00"), sede_id: "sede-b" });
    await ingresarComo(Escenario.veterinarioEnDosLugares());
    await render(<PerfilVet />);
    await fireEvent.press(screen.getByText("Consultorio Centro"));
    await fireEvent.press(screen.getByText("Eliminar este lugar"));
    expect(Avisos.estado.banner?.mensaje).toMatch(/tiene turnos pendientes/);
    expect(Avisos.estado.carteles).toHaveLength(0);
    expect(PerfilVetRepo.sedes).toHaveLength(2);
  });
});
