/* Migrado de PanelAvisosTest.kt (+ pruebas de TarjetaAviso.tiempo/estilo). */
import "../soporte/pruebaBase"; // simula los módulos nativos (almacenamiento y notificaciones) antes de importar los repositorios
import { LocalDate, LocalDateTime } from "../../src/util/tiempo";
import { textoInsignia } from "../../src/ui/common/Insignia";
import { PanelAvisos } from "../../src/ui/common/PanelAvisos";
import { TarjetaAviso } from "../../src/ui/common/TarjetaAviso";
import { Colores } from "../../src/ui/common/tema";

const hoy = LocalDate.of(2026, 5, 20);

describe("PanelAvisos", () => {
  it("grupo clasifica por antigüedad", () => {
    expect(PanelAvisos.grupo(hoy, hoy)).toBe("HOY");
    expect(PanelAvisos.grupo(hoy.minusDays(1), hoy)).toBe("AYER");
    expect(PanelAvisos.grupo(hoy.minusDays(4), hoy)).toBe("ESTA SEMANA");
    expect(PanelAvisos.grupo(hoy.minusDays(6), hoy)).toBe("ESTA SEMANA");
    expect(PanelAvisos.grupo(hoy.minusDays(7), hoy)).toBe("ANTERIORES");
    expect(PanelAvisos.grupo(hoy.minusDays(20), hoy)).toBe("ANTERIORES");
  });

  it("resumen describe el estado", () => {
    expect(PanelAvisos.resumen(0, 0)).toBe("Estás al día");
    expect(PanelAvisos.resumen(3, 0)).toBe("Todo leído");
    expect(PanelAvisos.resumen(3, 1)).toBe("1 sin leer");
    expect(PanelAvisos.resumen(5, 4)).toBe("4 sin leer");
  });

  it("la insignia topea en nueve más", () => {
    expect(textoInsignia(3)).toBe("3");
    expect(textoInsignia(9)).toBe("9");
    expect(textoInsignia(10)).toBe("9+");
  });
});

describe("TarjetaAviso", () => {
  const ahora = LocalDateTime.of(2026, 5, 20, 12, 0, 30);

  it("tiempo: ahora mismo, minutos, horas y días", () => {
    expect(TarjetaAviso.tiempo(LocalDateTime.of(2026, 5, 20, 12, 0, 0), ahora)).toBe("Ahora mismo");
    expect(TarjetaAviso.tiempo(LocalDateTime.of(2026, 5, 20, 11, 55, 0), ahora)).toBe("Hace 5 min");
    expect(TarjetaAviso.tiempo(LocalDateTime.of(2026, 5, 20, 10, 0, 0), ahora)).toBe("Hace 2 h");
    expect(TarjetaAviso.tiempo(LocalDateTime.of(2026, 5, 17, 12, 0, 0), ahora)).toBe("Hace 3 días");
  });

  it("estilo: ícono y colores por tipo", () => {
    expect(TarjetaAviso.estilo("CANCELACION")).toEqual({ fondo: Colores.lightOrange, color: Colores.accentOrange, icono: "cancelar" });
    expect(TarjetaAviso.estilo("TURNO").icono).toBe("calendario");
    expect(TarjetaAviso.estilo("COMPLETADO").color).toBe(Colores.successGreen);
    expect(TarjetaAviso.estilo("ACCESO").fondo).toBe(Colores.lightTeal);
    expect(TarjetaAviso.estilo("MASCOTA").icono).toBe("perro");
    expect(TarjetaAviso.estilo("CUENTA").icono).toBe("candado");
  });
});
