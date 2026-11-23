import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import type { FuenteEnMemoria } from "../../soporte/fuenteEnMemoria";
import { Avisos } from "../../../src/ui/common/Avisos";
import { EstadoAuth, type RegistroTerminado } from "../../../src/ui/auth/estadoAuth";
import RegistroDuenoPantalla from "../../../src/ui/auth/RegistroDuenoPantalla";

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
});

const escribir = (etiqueta: string, texto: string) => fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
const tocar = (texto: string) => fireEvent.press(screen.getByText(texto));
/** "Crear cuenta" es también el título de la pantalla: el botón se busca por su rol. */
const crear = () => fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));

async function pasoDatosPersonales() {
  await escribir("Nombre y apellido", "Ana Prueba");
  await escribir("DNI", "30111222");
  await escribir("Teléfono de contacto", "11 4444-5555");
  await tocar("Continuar");
}

async function pasoDomicilio() {
  await escribir("Calle y número", "Av. Santa Fe 1234");
  await escribir("Piso y departamento (opcional)", "3° B");
  await escribir("Ciudad o localidad", "Ciudad Autónoma de Buenos Aires");
  await tocar("Continuar");
}

describe("RegistroDuenoPantalla", () => {
  it("empieza en el paso 1 con su título y sin botón Atrás", async () => {
    await render(<RegistroDuenoPantalla />);
    expect(screen.getByText("Paso 1 de 4 · Datos personales")).toBeTruthy();
    expect(screen.getByText("Contanos quién sos")).toBeTruthy();
    expect(screen.queryByText("Atrás")).toBeNull();
  });

  it("valida los datos personales con los mismos mensajes", async () => {
    await render(<RegistroDuenoPantalla />);
    await tocar("Continuar");
    expect(screen.getByText("Ingresá tu nombre y apellido")).toBeTruthy();
    expect(screen.getByText("El DNI debe tener 7 u 8 números")).toBeTruthy();
    expect(screen.getByText("Ingresá un teléfono válido")).toBeTruthy();
    expect(screen.getByText("Paso 1 de 4 · Datos personales")).toBeTruthy();

    await escribir("Nombre y apellido", "Ana");
    await escribir("DNI", "12345678");
    await escribir("Teléfono de contacto", "1234");
    await tocar("Continuar");
    expect(screen.getByText("Ingresá tu nombre y apellido")).toBeTruthy();
    expect(screen.queryByText("El DNI debe tener 7 u 8 números")).toBeNull();
    expect(screen.getByText("Ingresá un teléfono válido")).toBeTruthy();
  });

  it("el DNI solo acepta números", async () => {
    await render(<RegistroDuenoPantalla />);
    await escribir("DNI", "30.111-222a");
    expect(screen.getByLabelText("DNI").props.value).toBe("30111222");
  });

  it("valida el domicilio", async () => {
    await render(<RegistroDuenoPantalla />);
    await pasoDatosPersonales();
    expect(screen.getByText("Paso 2 de 4 · Domicilio")).toBeTruthy();
    await tocar("Continuar");
    expect(screen.getByText("Ingresá tu calle y número")).toBeTruthy();
    expect(screen.getByText("Ingresá tu ciudad o localidad")).toBeTruthy();
  });

  it("sin mascotas el botón dice Omitir por ahora y deja seguir", async () => {
    await render(<RegistroDuenoPantalla />);
    await pasoDatosPersonales();
    await pasoDomicilio();
    expect(screen.getByText("Paso 3 de 4 · Tus mascotas")).toBeTruthy();
    expect(screen.getByText("Todavía no cargaste ninguna mascota. Podés agregarlas ahora o más tarde.")).toBeTruthy();
    await tocar("Omitir por ahora");
    expect(screen.getByText("Paso 4 de 4 · Tu cuenta")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeTruthy();
  });

  it("Atrás vuelve al paso anterior", async () => {
    await render(<RegistroDuenoPantalla />);
    await pasoDatosPersonales();
    await tocar("Atrás");
    expect(screen.getByText("Paso 1 de 4 · Datos personales")).toBeTruthy();
  });

  it("salir del primer paso con datos cargados pide confirmar; sin datos sale directo", async () => {
    await render(<RegistroDuenoPantalla />);
    await fireEvent.press(screen.getByLabelText("Volver atrás"));
    expect(enrutador.back).toHaveBeenCalledTimes(1);

    await escribir("Nombre y apellido", "Ana Prueba");
    await fireEvent.press(screen.getByLabelText("Volver atrás"));
    expect(Avisos.estado.carteles).toHaveLength(1);
    expect(Avisos.estado.carteles[0].titulo).toBe("Salir del registro");
    expect(Avisos.estado.carteles[0].textoCancelar).toBe("Seguir registrándome");
    Avisos.cerrarCartel(Avisos.estado.carteles[0].id, true);
    expect(enrutador.back).toHaveBeenCalledTimes(2);
  });

  it("carga una mascota con el diálogo y la muestra en la lista", async () => {
    await render(<RegistroDuenoPantalla />);
    await pasoDatosPersonales();
    await pasoDomicilio();
    await tocar("Agregar mascota");
    expect(screen.getByText("Nueva mascota")).toBeTruthy();

    // Sin nombre no guarda
    await tocar("Guardar mascota");
    expect(screen.getByText("Ingresá el nombre")).toBeTruthy();

    await escribir("Nombre", "Luna");
    await tocar("Guardar mascota");
    expect(Avisos.estado.banner?.mensaje).toBe("Elegí qué tipo de mascota es");
    await tocar("Perro");
    await tocar("Guardar mascota");
    expect(Avisos.estado.banner?.mensaje).toBe("Elegí el sexo de la mascota");
    await tocar("Hembra");

    await escribir("Microchip", "123");
    await tocar("Guardar mascota");
    expect(screen.getByText("El microchip tiene 15 dígitos")).toBeTruthy();
    await escribir("Microchip", "123456789012345");
    await escribir("Raza (opcional)", "Mestiza");
    await escribir("Peso (kg)", "12.5");
    await tocar("Guardar mascota");

    expect(screen.queryByText("Nueva mascota")).toBeNull();
    expect(screen.getByText("Luna")).toBeTruthy();
    expect(screen.getByText("Perro · Mestiza · Hembra")).toBeTruthy();
    expect(screen.getByText("Continuar")).toBeTruthy();
  });

  it("crea la cuenta con las mascotas y avisa al ingreso", async () => {
    await render(<RegistroDuenoPantalla />);
    await pasoDatosPersonales();
    await pasoDomicilio();
    await tocar("Agregar mascota");
    await escribir("Nombre", "Luna");
    await tocar("Perro");
    await tocar("Hembra");
    await escribir("Peso (kg)", "12.5");
    await tocar("Guardar mascota");
    await tocar("Continuar");

    // Validaciones de la cuenta
    await crear();
    expect(Avisos.estado.banner?.mensaje).toBe("Tenés que aceptar los términos y condiciones");
    expect(screen.getByText("Correo inválido")).toBeTruthy();
    expect(screen.getByText("Mínimo 6 caracteres")).toBeTruthy();

    await escribir("Correo electrónico", "Ana.Nueva@Prueba.test");
    await escribir("Contraseña", "secreta1");
    await escribir("Confirmar contraseña", "distinta");
    await crear();
    expect(screen.getByText("Las contraseñas no coinciden")).toBeTruthy();
    await escribir("Confirmar contraseña", "secreta1");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Acepto los términos y condiciones" }));
    expect(screen.getByText(/Ana Prueba · DNI 30111222/)).toBeTruthy();
    expect(screen.getByText(/Mascotas: Luna \(perro\)/)).toBeTruthy();

    await crear();
    await waitFor(() => expect(terminados).toHaveLength(1));
    expect(terminados[0]).toEqual({ email: "ana.nueva@prueba.test", confirmarCorreo: false, esVeterinario: false });
    expect(servidor.llamadas).toContain("registrar:ana.nueva@prueba.test");
    const datos = servidor.ultimosDatosDeRegistro as Record<string, unknown>;
    expect(datos.rol).toBe("dueno");
    expect(datos.nombre).toBe("Ana Prueba");
    expect(datos.direccion).toBe("Av. Santa Fe 1234, 3° B, Ciudad Autónoma de Buenos Aires");
    expect(datos.terminos_version).toBe("1.0");
    expect((datos.mascotas as Array<Record<string, unknown>>)[0]).toMatchObject({ nombre: "Luna", tipo: "Perro", sexo: "Hembra", peso: "12.5 kg" });
    expect(enrutador.back).toHaveBeenCalled();
  });

  it("si el correo ya está registrado lo marca en el campo", async () => {
    jest.spyOn(servidor, "registrar").mockResolvedValue({ sesionIniciada: false, usuarioId: null, correoYaRegistrado: true });
    await render(<RegistroDuenoPantalla />);
    await pasoDatosPersonales();
    await pasoDomicilio();
    await tocar("Omitir por ahora");
    await escribir("Correo electrónico", "ana@prueba.test");
    await escribir("Contraseña", "secreta1");
    await escribir("Confirmar contraseña", "secreta1");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Acepto los términos y condiciones" }));
    await crear();
    expect(await screen.findByText("Ese correo ya está registrado")).toBeTruthy();
    expect(terminados).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeTruthy();
  });

  it("un error del servidor se muestra y deja volver a intentar", async () => {
    jest.spyOn(servidor, "registrar").mockRejectedValue(new Error("Sin conexión con el servidor"));
    await render(<RegistroDuenoPantalla />);
    await pasoDatosPersonales();
    await pasoDomicilio();
    await tocar("Omitir por ahora");
    await escribir("Correo electrónico", "ana@prueba.test");
    await escribir("Contraseña", "secreta1");
    await escribir("Confirmar contraseña", "secreta1");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Acepto los términos y condiciones" }));
    await crear();
    await waitFor(() => expect(Avisos.estado.carteles).toHaveLength(1));
    expect(terminados).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeTruthy();
  });
});
