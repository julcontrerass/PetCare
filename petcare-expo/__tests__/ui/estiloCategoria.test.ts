/* EstiloCategoria y utilidades de ComponentesDueno. */
import "../soporte/pruebaBase"; // simula almacenamiento y notificaciones antes de importar los repositorios
import { CatalogoMedico } from "../../src/data/catalogoMedico";
import { Iconos } from "../../src/ui/common/Icono";
import { Colores } from "../../src/ui/common/tema";
import { EstiloCategoria } from "../../src/ui/common/EstiloCategoria";
import { diasHasta } from "../../src/ui/common/ComponentesDueno";
import { LocalDate, Reloj } from "../../src/util/tiempo";

describe("EstiloCategoria", () => {
  it("las categorías genéricas se reconocen por palabras", () => {
    expect(EstiloCategoria.icono("Vacuna antirrábica")).toBe("vacuna");
    expect(EstiloCategoria.fondo("Vacuna antirrábica")).toBe(Colores.iconGreenBg);
    expect(EstiloCategoria.colorIcono("Vacuna antirrábica")).toBe(Colores.successGreen);
    expect(EstiloCategoria.icono("Castración")).toBe("cirugia");
    expect(EstiloCategoria.colorIcono("Castración")).toBe(Colores.dangerRed);
    expect(EstiloCategoria.icono("Control anual")).toBe("botiquin");
    expect(EstiloCategoria.fondo("Control anual")).toBe(Colores.iconBlueBg);
    expect(EstiloCategoria.icono("Estudio de laboratorio")).toBe("pulso");
    expect(EstiloCategoria.icono("Peluquería")).toBe("perro");
    expect(EstiloCategoria.fondo("Desparasitación")).toBe(Colores.iconOrangeBg);
  });

  it("sin categoría o desconocida usa los valores por defecto", () => {
    expect(EstiloCategoria.icono(null)).toBe("calendario");
    expect(EstiloCategoria.fondo(null)).toBe(Colores.iconTealBg);
    expect(EstiloCategoria.colorIcono(null)).toBe(Colores.primaryTeal);
    expect(EstiloCategoria.icono("Otra cosa")).toBe("calendario");
    expect(EstiloCategoria.fondo("Otra cosa")).toBe(Colores.iconPurpleBg);
    expect(EstiloCategoria.colorIcono("Otra cosa")).toBe(Colores.accentPurple);
  });

  it("cada servicio y especialidad del catálogo tiene un ícono que existe en el kit", () => {
    for (const nombre of CatalogoMedico.TODAS) {
      const estilo = EstiloCategoria.servicio(nombre);
      expect(Object.keys(Iconos)).toContain(estilo.icono);
      expect(estilo.icono).not.toBe("calendario");
      expect(EstiloCategoria.icono(nombre)).toBe(estilo.icono);
      expect(EstiloCategoria.fondo(nombre)).toBe(estilo.fondo);
      expect(EstiloCategoria.colorIcono(nombre)).toBe(estilo.color);
    }
    expect(EstiloCategoria.servicio("Cirugía 24hs")).toEqual({ icono: "cirugia", fondo: Colores.iconPinkBg, color: Colores.dangerRed });
  });

  it("el estilo del encabezado de un turno", () => {
    expect(EstiloCategoria.turno("Vacunación")).toEqual({ icono: "vacuna", fondo: Colores.lightTeal, color: Colores.primaryTeal });
    expect(EstiloCategoria.turno("Chequeo").icono).toBe("pulso");
    expect(EstiloCategoria.turno("Cirugía").color).toBe(Colores.accentOrange);
    expect(EstiloCategoria.turno("Otro")).toEqual({ icono: "actividad", fondo: Colores.lightPurple, color: Colores.accentPurple });
  });
});

describe("ComponentesDueno", () => {
  afterEach(() => Reloj.fijar(null));

  it("diasHasta cuenta los días desde hoy", () => {
    Reloj.fijar(new Date(2026, 4, 20, 12, 0, 0));
    expect(diasHasta(LocalDate.of(2026, 5, 20))).toBe(0);
    expect(diasHasta(LocalDate.of(2026, 5, 21))).toBe(1);
    expect(diasHasta(LocalDate.of(2026, 5, 18))).toBe(-2);
  });
});
