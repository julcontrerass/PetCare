/* A dónde lleva tocar cada notificación, del dueño y del veterinario. */
import { Mascota } from "../../src/model/modelos";
import { destinoAvisoDueno, mascotaDelAviso } from "../../src/ui/dueno/destinoAviso";
import { destinoAvisoVet } from "../../src/ui/veterinario/destinoAviso";

const luna = new Mascota("Luna", "Perro", { id: "m1" });
const lunita = new Mascota("Lunita", "Gato", { id: "m2" });
const mascotas = [luna, lunita];

describe("mascotaDelAviso", () => {
  it("encuentra la mascota nombrada, sin confundir nombres parecidos", () => {
    expect(mascotaDelAviso("Luna: el turno de Vacuna del 12/12/2026 10:00 fue completado.", mascotas)).toBe(luna);
    expect(mascotaDelAviso("Lunita volvió a estar activa.", mascotas)).toBe(lunita);
    expect(mascotaDelAviso("Agregaste a LUNA (Perro) a tus mascotas.", mascotas)).toBe(luna);
    expect(mascotaDelAviso("Nada que ver", mascotas)).toBeNull();
  });
});

describe("destinoAvisoDueno", () => {
  const aviso = (tipo: Parameters<typeof destinoAvisoDueno>[0]["tipo"], titulo: string, mensaje = "") => destinoAvisoDueno({ tipo, titulo, mensaje }, mascotas);

  it("turnos y cancelaciones llevan al calendario", () => {
    expect(aviso("TURNO", "Nuevo turno", "Luna: Control el 12/12/2026 10:00")).toEqual({ a: "calendario" });
    expect(aviso("CANCELACION", "Turno cancelado")).toEqual({ a: "calendario" });
  });

  it("un turno completado lleva a la ficha de la mascota", () => {
    expect(aviso("COMPLETADO", "Turno finalizado", "Luna: el turno de Control fue completado.")).toEqual({ a: "mascota", mascota: luna });
    expect(aviso("COMPLETADO", "Turno finalizado", "Otra: completado")).toEqual({ a: "recordatorios" });
  });

  it("las solicitudes de acceso van a Solicitudes y los cambios a Veterinarios autorizados", () => {
    expect(aviso("ACCESO", "Solicitud de acceso")).toEqual({ a: "solicitudes" });
    expect(aviso("ACCESO", "Acceso actualizado")).toEqual({ a: "veterinarios" });
  });

  it("la invitación a compartir una mascota lleva al Inicio y el recordatorio del veterinario a Recordatorios", () => {
    expect(aviso("MASCOTA", "Te invitaron a compartir una mascota", "Ana te invitó a ser dueño/a de Luna.")).toEqual({ a: "inicio" });
    expect(aviso("MASCOTA", "Recordatorio de tu veterinario", "Dr. Vera te dejó un recordatorio para Luna")).toEqual({ a: "recordatorios" });
    expect(aviso("MASCOTA", "Mascota activa", "Lunita volvió a estar activa.")).toEqual({ a: "mascota", mascota: lunita });
    expect(aviso("CUENTA", "Cuenta")).toEqual({ a: "perfil" });
  });
});

describe("destinoAvisoVet", () => {
  it("cada tipo lleva a su sección", () => {
    expect(destinoAvisoVet({ tipo: "TURNO", titulo: "Nuevo turno" })).toBe("agenda");
    expect(destinoAvisoVet({ tipo: "COMPLETADO", titulo: "Turno finalizado" })).toBe("agenda");
    expect(destinoAvisoVet({ tipo: "ACCESO", titulo: "Nueva solicitud" })).toBe("solicitudes");
    expect(destinoAvisoVet({ tipo: "ACCESO", titulo: "Acceso actualizado" })).toBe("pacientes");
    expect(destinoAvisoVet({ tipo: "CUENTA", titulo: "Tu cuenta" })).toBe("perfil");
  });
});
