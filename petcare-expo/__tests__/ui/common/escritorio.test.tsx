/* Formato de escritorio de la web: menú lateral, grilla y ancho de las pantallas (y que el teléfono no cambie). */
import { Dimensions, Platform, Pressable, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { enrutador, fijarRuta } from "../../soporte/rutas";
import { ingresarComoDueno, ingresarComoVeterinario, limpiarServicios, prepararServicios } from "../../soporte/pruebaBase";
import { Grilla } from "../../../src/ui/common/Grilla";
import { MarcoConMenu, MenuLateral } from "../../../src/ui/common/MenuLateral";
import { PantallaBase } from "../../../src/ui/common/PantallaBase";
import { ANCHO_COLUMNA, ANCHO_CONTENIDO, ANCHO_FORMULARIO, useFoco } from "../../../src/ui/common/Web";
import { MenuLateralDueno, seccionLateralDeRuta } from "../../../src/ui/dueno/BarraInferior";
import { CascaronVet } from "../../../src/ui/veterinario/CascaronVet";
import { MenuLateralVet, seccionLateralVet } from "../../../src/ui/veterinario/BarraVet";

const ventana = Dimensions.get("window");

async function ancho(width: number) {
  await act(async () => Dimensions.set({ window: { ...ventana, width, height: 800 } }));
}

beforeEach(() => {
  prepararServicios();
  fijarRuta();
});
afterEach(async () => {
  await act(async () => Dimensions.set({ window: ventana }));
  limpiarServicios();
});

describe("MenuLateral", () => {
  it("muestra la acción principal, las secciones, las otras opciones y cerrar sesión", async () => {
    const principal = jest.fn();
    const inicio = jest.fn();
    const perfil = jest.fn();
    const salir = jest.fn();
    await render(
      <MenuLateral
        principal={{ texto: "Agendar evento", icono: "mas", alTocar: principal }}
        secciones={[{ clave: "inicio", texto: "Inicio", icono: "inicio", activo: true, alTocar: inicio }]}
        otras={[{ clave: "perfil", texto: "Mi perfil", icono: "persona", insignia: 3, alTocar: perfil }]}
        alCerrarSesion={salir}
      />,
    );
    expect(screen.getByRole("link", { name: "Inicio" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("link", { name: "Mi perfil" }).props.accessibilityState.selected).toBe(false);
    expect(screen.getByLabelText("3 notificaciones sin leer")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Agendar evento" }));
    await fireEvent.press(screen.getByRole("link", { name: "Mi perfil" }));
    await fireEvent.press(screen.getByRole("link", { name: "Cerrar sesión" }));
    expect(principal).toHaveBeenCalled();
    expect(perfil).toHaveBeenCalled();
    expect(salir).toHaveBeenCalled();
    expect(inicio).not.toHaveBeenCalled();
  });
});

describe("MarcoConMenu", () => {
  it("en el teléfono no dibuja el menú", async () => {
    await ancho(390);
    await render(<MarcoConMenu menu={<Text>MENU</Text>}><Text>PANTALLA</Text></MarcoConMenu>);
    expect(screen.getByText("PANTALLA")).toBeTruthy();
    expect(screen.queryByText("MENU")).toBeNull();
  });

  it("desde 900 px pone el menú al costado de la pantalla", async () => {
    await ancho(1280);
    await render(<MarcoConMenu menu={<Text>MENU</Text>}><Text>PANTALLA</Text></MarcoConMenu>);
    expect(screen.getByText("MENU")).toBeTruthy();
    expect(screen.getByText("PANTALLA")).toBeTruthy();
  });
});

describe("Grilla", () => {
  const tarjetas = ["A", "B", "C"].map((t) => <Text key={t}>{t}</Text>);

  it("en el teléfono deja los hijos uno debajo del otro, sin envolverlos", async () => {
    await ancho(390);
    await render(<Grilla columnas={2}>{tarjetas}</Grilla>);
    // Siguen siendo hermanas, como si no hubiera grilla
    expect(screen.getByText("A").parent).toBe(screen.getByText("C").parent);
  });

  it("en escritorio los reparte en filas de N columnas", async () => {
    await ancho(1280);
    await render(<Grilla columnas={2}>{tarjetas}</Grilla>);
    for (const t of ["A", "B", "C"]) expect(screen.getByText(t)).toBeTruthy();
    // A y B en la primera fila, C en la segunda
    const fila = (t: string) => screen.getByText(t).parent?.parent;
    expect(fila("A")).toBe(fila("B"));
    expect(fila("A")).not.toBe(fila("C"));
  });
});

describe("PantallaBase: ancho de la columna", () => {
  const anchoDe = () => {
    const columna = screen.getByText("contenido");
    let nodo = columna.parent;
    while (nodo) {
      const estilos = [nodo.props.style].flat(Infinity) as ({ maxWidth?: number } | null)[];
      const conAncho = estilos.find((e) => e && e.maxWidth != null);
      if (conAncho) return conAncho.maxWidth;
      nodo = nodo.parent;
    }
    return undefined;
  };

  it("en el teléfono sigue siendo la columna de 480", async () => {
    await ancho(390);
    await render(<PantallaBase><Text>contenido</Text></PantallaBase>);
    expect(anchoDe()).toBe(ANCHO_COLUMNA);
  });

  it("en escritorio usa el ancho de contenido, o el de formulario", async () => {
    await ancho(1280);
    await render(<PantallaBase><Text>contenido</Text></PantallaBase>);
    expect(anchoDe()).toBe(ANCHO_CONTENIDO);
    await render(<PantallaBase formulario><Text>contenido</Text></PantallaBase>);
    expect(anchoDe()).toBe(ANCHO_FORMULARIO);
  });
});

describe("useFoco en la web", () => {
  const original = Platform.OS;
  const oyentes: Record<string, (() => void)[]> = {};
  beforeEach(() => {
    Platform.OS = "web";
    (globalThis as unknown as { document: unknown }).document = {
      addEventListener: (tipo: string, o: () => void) => (oyentes[tipo] ??= []).push(o),
      removeEventListener: () => {},
    };
  });
  afterEach(() => {
    Platform.OS = original;
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  function Boton() {
    const foco = useFoco();
    return <Pressable accessibilityRole="button" accessibilityLabel="B" {...foco.props}><Text>{foco.enfocado ? "con anillo" : "sin anillo"}</Text></Pressable>;
  }

  it("el anillo aparece al llegar con Tab y no al tocar con el mouse", async () => {
    await render(<Boton />);
    const boton = screen.getByRole("button", { name: "B" });
    await act(async () => oyentes.mousedown?.forEach((o) => o()));
    await act(async () => boton.props.onFocus());
    expect(screen.getByText("sin anillo")).toBeTruthy();
    await act(async () => boton.props.onBlur());
    await act(async () => oyentes.keydown?.forEach((o) => o()));
    await act(async () => boton.props.onFocus());
    expect(screen.getByText("con anillo")).toBeTruthy();
  });
});

describe("Menú lateral del dueño", () => {
  it("marca la sección de cada ruta", () => {
    expect(seccionLateralDeRuta("/dueno")).toBe("inicio");
    expect(seccionLateralDeRuta("/dueno/mascotas")).toBe("mascotas");
    expect(seccionLateralDeRuta("/dueno/mascota/123")).toBe("mascotas");
    expect(seccionLateralDeRuta("/dueno/perfil-editar")).toBe("perfil");
    expect(seccionLateralDeRuta("/dueno/carnet")).toBe("salud");
  });

  it("tiene las pestañas y las opciones del menú Más, y navega", async () => {
    await ingresarComoDueno();
    await render(<MenuLateralDueno ruta="/dueno/mascotas" />);
    expect(screen.getByRole("link", { name: "Mascotas" }).props.accessibilityState.selected).toBe(true);
    for (const t of ["Inicio", "Recordatorios", "Mi perfil", "Veterinarios autorizados", "Solicitudes de acceso", "Calendario"]) {
      expect(screen.getByRole("link", { name: t })).toBeTruthy();
    }
    await fireEvent.press(screen.getByRole("link", { name: "Calendario" }));
    expect(enrutador.navigate.mock.calls.flat().join(" ") + enrutador.push.mock.calls.flat().join(" ")).toContain("calendario");
  });
});

describe("Menú lateral del veterinario", () => {
  it("marca la sección de cada ruta, también en las pantallas de detalle", () => {
    expect(seccionLateralVet("/vet")).toBe("inicio");
    expect(seccionLateralVet("/vet/paciente/1")).toBe("pacientes");
    expect(seccionLateralVet("/vet/evento/1")).toBe("agenda");
    expect(seccionLateralVet("/vet/perfil")).toBe("perfil");
  });

  it("el botón principal abre Agregar consulta", async () => {
    await render(<MenuLateralVet ruta="/vet" />);
    await fireEvent.press(screen.getByRole("button", { name: "Agregar consulta" }));
    expect(enrutador.push).toHaveBeenCalledWith("/vet/consulta-nueva");
  });

  it("en escritorio el cascarón no dibuja la barra inferior", async () => {
    await ancho(1280);
    await ingresarComoVeterinario();
    await render(<CascaronVet />);
    expect(screen.queryByRole("tab", { name: "Pacientes" })).toBeNull();
  });
});
