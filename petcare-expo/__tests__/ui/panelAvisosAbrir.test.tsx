/* Tocar un aviso del panel cierra el panel y lleva a lo que avisa. */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PanelAvisos, type ItemAviso } from "../../src/ui/common/PanelAvisos";
import { LocalDateTime } from "../../src/util/tiempo";

const aviso: ItemAviso = {
  tipo: "TURNO", titulo: "Nuevo turno", mensaje: "Luna: Control el 12/12/2026 10:00", creada: LocalDateTime.now(), sinLeer: true,
};

describe("PanelAvisos: abrir un aviso", () => {
  it("cierra el panel y avisa cuál se tocó", async () => {
    const alCerrar = jest.fn();
    const alAbrir = jest.fn();
    await render(<PanelAvisos visible alCerrar={alCerrar} avisos={[aviso]} alBorrar={() => {}} alBorrarTodas={() => {}} alAbrir={alAbrir} />);
    await fireEvent.press(screen.getByRole("button", { name: "Nuevo turno. Luna: Control el 12/12/2026 10:00" }));
    expect(alCerrar).toHaveBeenCalled();
    expect(alAbrir).toHaveBeenCalledWith(aviso);
  });

  it("sin alAbrir los avisos no se pueden tocar", async () => {
    await render(<PanelAvisos visible alCerrar={() => {}} avisos={[aviso]} alBorrar={() => {}} alBorrarTodas={() => {}} />);
    expect(screen.queryByRole("button", { name: /Nuevo turno\./ })).toBeNull();
  });
});
