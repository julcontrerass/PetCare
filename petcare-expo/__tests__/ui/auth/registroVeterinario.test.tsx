import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { ingresarComoDueno, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import type { FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { CredencialVet } from "../../../src/data/credencialVet";
import { Imagenes } from "../../../src/data/imagenes";
import { PerfilVetRepo } from "../../../src/data/repositorio/perfilVetRepo";
import { Avisos } from "../../../src/ui/common/Avisos";
import { EstadoAuth, type RegistroTerminado } from "../../../src/ui/auth/estadoAuth";
import RegistroVeterinarioPantalla from "../../../src/ui/auth/RegistroVeterinarioPantalla";

jest.mock("../../../src/ui/auth/elegirFoto", () => ({
  elegirFoto: jest.fn(async () => "file:///carnet.jpg"),
  descartarFoto: jest.fn(),
}));

let servidor: FuenteEnMemoria;
let terminados: RegistroTerminado[];

beforeEach(() => {
  servidor = prepararServicios();
  fijarRuta();
  Avisos.reiniciar();
  terminados = [];
  EstadoAuth.alTerminarRegistro = (r) => terminados.push(r);
});
afterEach(() => {
  EstadoAuth.alTerminarRegistro = null;
  limpiarServicios();
  Avisos.reiniciar();
  jest.restoreAllMocks();
});

const escribir = (etiqueta: string, texto: string) => fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
const tocar = (texto: string) => fireEvent.press(screen.getByText(texto));
const boton = (nombre: string) => fireEvent.press(screen.getByRole("button", { name: nombre }));
const especialidad = PerfilVetRepo.todasLasEspecialidades[0];

async function paso1() {
  await tocar("Dra.");
  await escribir("Nombre y apellido", "Ana Gómez");
  await escribir("DNI", "28999888");
  await escribir("Teléfono de contacto", "11 4000-1234");
  await tocar("Continuar");
}

async function paso2() {
  await escribir("Matrícula profesional", "MP-12345");
  await escribir("Veterinaria o clínica donde atendés", "Clínica Central");
  await escribir("Dirección de la veterinaria", "Av. Siempreviva 742");
  await tocar("Elegir foto del carnet");
  await tocar("Continuar");
}

async function paso3() {
  await tocar(especialidad);
  await tocar("Perros");
  await tocar("Continuar");
}

describe("RegistroVeterinarioPantalla: alta de cuenta nueva", () => {
  it("empieza en el paso 1 de 5 con los títulos del Kotlin", async () => {
    await render(<RegistroVeterinarioPantalla />);
    expect(screen.getByText("Cuenta profesional")).toBeTruthy();
    expect(screen.getByText("Paso 1 de 5 · Datos personales")).toBeTruthy();
    expect(screen.getByText("Cómo querés que te llamemos")).toBeTruthy();
  });

  it("pide elegir Dr. o Dra. y valida los datos personales", async () => {
    await render(<RegistroVeterinarioPantalla />);
    await tocar("Continuar");
    expect(Avisos.estado.banner?.mensaje).toBe("Elegí si sos Dr. o Dra.");
    expect(screen.getByText("Ingresá tu nombre y apellido")).toBeTruthy();
    expect(screen.getByText("El DNI debe tener 7 u 8 números")).toBeTruthy();
    expect(screen.getByText("Ingresá un teléfono válido")).toBeTruthy();
    expect(screen.getByText("Paso 1 de 5 · Datos personales")).toBeTruthy();
  });

  it("valida la matrícula, la veterinaria, la dirección y el carnet", async () => {
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    expect(screen.getByText("Paso 2 de 5 · Profesión y veterinaria")).toBeTruthy();
    await tocar("Continuar");
    expect(screen.getByText("Ingresá tu matrícula")).toBeTruthy();
    expect(screen.getByText("Ingresá el nombre de la veterinaria")).toBeTruthy();
    expect(screen.getByText("Ingresá la dirección de la veterinaria")).toBeTruthy();
    expect(Avisos.estado.banner?.mensaje).toBe("Subí la foto de tu carnet o matrícula para que el administrador pueda verificarte");
  });

  it("pide al menos una especialidad y un tipo de animal", async () => {
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    await paso2();
    expect(screen.getByText("Paso 3 de 5 · Especialidades")).toBeTruthy();
    expect(screen.getByText("Ninguna seleccionada")).toBeTruthy();
    await tocar("Continuar");
    expect(screen.getByText("Elegí al menos una especialidad")).toBeTruthy();
    expect(screen.getByText("Elegí al menos un tipo de animal")).toBeTruthy();
    await tocar(especialidad);
    expect(screen.getByText("1 seleccionada")).toBeTruthy();
    expect(screen.queryByText("Elegí al menos una especialidad")).toBeNull();
    await tocar("Perros");
    expect(screen.queryByText("Elegí al menos un tipo de animal")).toBeNull();
  });

  it("el horario de cierre tiene que ser posterior al de apertura", async () => {
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    await paso2();
    await paso3();
    expect(screen.getByText("Paso 4 de 5 · Días y horarios")).toBeTruthy();
    expect(screen.getByText(/Atendés Lun, Mar, Mié, Jue, Vie de 09:00 a 18:00 hs/)).toBeTruthy();
    await boton("Hasta: 18:00 hs");
    await tocar("08");
    await tocar("Aceptar");
    expect(screen.getByText("El horario de cierre tiene que ser posterior al de apertura.")).toBeTruthy();
    await tocar("Continuar");
    expect(Avisos.estado.banner?.mensaje).toBe("El horario de cierre tiene que ser posterior al de apertura");
    expect(screen.getByText("Paso 4 de 5 · Días y horarios")).toBeTruthy();
  });

  it("sin días elegidos no deja seguir y los atajos eligen de lunes a sábado", async () => {
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    await paso2();
    await paso3();
    for (const dia of ["Lun", "Mar", "Mié", "Jue", "Vie"]) await tocar(dia);
    expect(screen.getByText("Elegí al menos un día de atención.")).toBeTruthy();
    await tocar("Continuar");
    expect(Avisos.estado.banner?.mensaje).toBe("Elegí al menos un día de atención");
    await tocar("Lunes a sábado");
    expect(screen.getByText(/Atendés Lun, Mar, Mié, Jue, Vie, Sáb de/)).toBeTruthy();
  });

  it("suma otra veterinaria con su editor y la lista en el resumen", async () => {
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    await tocar("Elegir foto del carnet");
    await tocar("Agregar otra veterinaria");
    expect(screen.getByText("Cada lugar tiene su dirección, sus días y sus horarios.")).toBeTruthy();
    await tocar("Guardar");
    expect(screen.getByText("Ingresá el nombre de la veterinaria")).toBeTruthy();
    await escribir("Nombre de la veterinaria", "Consultorio Centro");
    await escribir("Dirección", "San Martín 100");
    await tocar("Guardar");
    expect(screen.queryByText("Cada lugar tiene su dirección, sus días y sus horarios.")).toBeNull();
    expect(screen.getByText("Consultorio Centro")).toBeTruthy();
    expect(screen.getByText(/San Martín 100/)).toBeTruthy();
  });

  it("crea la cuenta, informa que queda en revisión y avisa al ingreso", async () => {
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    await paso2();
    await paso3();
    await tocar("Continuar");
    expect(screen.getByText("Paso 5 de 5 · Tu cuenta")).toBeTruthy();
    expect(screen.getByText(/Matrícula MP-12345/)).toBeTruthy();
    expect(screen.getByText(/Animales: Perros/)).toBeTruthy();

    await boton("Crear cuenta");
    expect(screen.getByText("Correo inválido")).toBeTruthy();
    expect(screen.getByText("Mínimo 6 caracteres")).toBeTruthy();
    expect(Avisos.estado.banner?.mensaje).toBe("Tenés que aceptar los términos y condiciones");

    await escribir("Correo electrónico", "Vet.Nuevo@Prueba.test");
    await escribir("Contraseña", "secreta1");
    await escribir("Confirmar contraseña", "secreta1");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Acepto los términos y condiciones" }));
    await boton("Crear cuenta");

    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    const cartel = Avisos.estado.carteles[0];
    expect(cartel.titulo).toBe("Registro en revisión");
    expect(cartel.cancelable).toBe(false);
    expect(cartel.mensaje).toContain("¡Muchas gracias, Dra. Ana Gómez!");
    expect(cartel.mensaje).toContain("(MP-12345)");
    const datos = servidor.ultimosDatosDeRegistro as Record<string, unknown>;
    expect(datos).toMatchObject({
      rol: "veterinario", nombre: "Dra. Ana Gómez", dni: "28999888", matricula: "MP-12345", clinica: "Clínica Central",
      direccion_clinica: "Av. Siempreviva 742", especialidades: [especialidad], tipos_animales: ["Perro"],
      dias_atencion: [1, 2, 3, 4, 5], hora_apertura: "09:00", hora_cierre: "18:00",
    });
    // Al aceptar el cartel se avisa al ingreso y se cierra la pantalla
    expect(terminados).toHaveLength(0);
    Avisos.cerrarCartel(cartel.id, true);
    expect(terminados).toEqual([{ email: "vet.nuevo@prueba.test", confirmarCorreo: false, esVeterinario: true }]);
    expect(enrutador.back).toHaveBeenCalled();
  });

  it("una matrícula repetida se informa como error", async () => {
    servidor.matriculasEnUso.add("mp-12345");
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    await paso2();
    await paso3();
    await tocar("Continuar");
    await escribir("Correo electrónico", "vet@prueba.test");
    await escribir("Contraseña", "secreta1");
    await escribir("Confirmar contraseña", "secreta1");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Acepto los términos y condiciones" }));
    await boton("Crear cuenta");
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(Avisos.estado.carteles[0].mensaje).toBe("Esa matrícula ya está registrada con otra cuenta");
  });

  it("si el correo ya existe explica cómo pedir el alta con la cuenta de dueño", async () => {
    jest.spyOn(servidor, "registrar").mockResolvedValue({ sesionIniciada: false, usuarioId: null, correoYaRegistrado: true });
    await render(<RegistroVeterinarioPantalla />);
    await paso1();
    await paso2();
    await paso3();
    await tocar("Continuar");
    await escribir("Correo electrónico", "ana@prueba.test");
    await escribir("Contraseña", "secreta1");
    await escribir("Confirmar contraseña", "secreta1");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Acepto los términos y condiciones" }));
    await boton("Crear cuenta");
    expect(await screen.findByText("Ese correo ya está registrado")).toBeTruthy();
    expect(Avisos.estado.carteles[0].titulo).toBe("Ese correo ya tiene una cuenta");
  });
});

describe("RegistroVeterinarioPantalla: cuenta existente (cuentaExistente=1)", () => {
  it("salta lo personal, no pide correo ni contraseña y envía la solicitud", async () => {
    await ingresarComoDueno();
    fijarRuta({ cuentaExistente: "1" });
    jest.spyOn(Imagenes, "prepararFoto").mockResolvedValue("file:///preparada.jpg");
    const subir = jest.spyOn(CredencialVet, "subirArchivo").mockResolvedValue("dueno-1/carnet.jpg");
    const solicitar = jest.spyOn(servidor, "solicitarAltaVeterinario");

    await render(<RegistroVeterinarioPantalla />);
    expect(screen.getByText("Paso 1 de 4 · Profesión y veterinaria")).toBeTruthy();
    expect(screen.queryByText("Atrás")).toBeNull();
    await paso2();
    await paso3();
    await tocar("Continuar");

    expect(screen.getByText("Paso 4 de 4 · Tu cuenta")).toBeTruthy();
    expect(screen.getByText("Revisá y enviá")).toBeTruthy();
    expect(screen.getByText("El administrador va a verificar tu matrícula. Mientras tanto seguís usando la app como dueño.")).toBeTruthy();
    expect(screen.queryByLabelText("Correo electrónico")).toBeNull();
    expect(screen.queryByLabelText("Contraseña")).toBeNull();
    expect(screen.queryByText("Acepto los términos y condiciones")).toBeNull();

    await boton("Enviar solicitud");
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(subir).toHaveBeenCalledWith("file:///preparada.jpg", "dueno-1");
    expect(solicitar).toHaveBeenCalledWith(
      expect.objectContaining({
        matricula: "MP-12345", clinica: "Clínica Central", direccionClinica: "Av. Siempreviva 742", dias: [1, 2, 3, 4, 5],
        apertura: "09:00", cierre: "18:00", especialidades: [especialidad], tiposAnimales: ["Perro"], credencialPath: "dueno-1/carnet.jpg",
      }),
    );
    expect(Avisos.estado.carteles[0].titulo).toBe("Solicitud enviada");
    expect(servidor.llamadas.some((l) => l.startsWith("registrar:"))).toBe(false);
    Avisos.cerrarCartel(Avisos.estado.carteles[0].id, true);
    expect(enrutador.back).toHaveBeenCalled();
    expect(terminados).toHaveLength(0);
  });

  it("sin sesión avisa que venció", async () => {
    fijarRuta({ cuentaExistente: "1" });
    await render(<RegistroVeterinarioPantalla />);
    await paso2();
    await paso3();
    await tocar("Continuar");
    await boton("Enviar solicitud");
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(Avisos.estado.carteles[0].mensaje).toBe("Tu sesión venció. Volvé a ingresar.");
  });
});
