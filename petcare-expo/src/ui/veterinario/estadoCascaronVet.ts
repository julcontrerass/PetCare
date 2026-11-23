import { elegirImagen } from "../common/Selectores";

/**
 * Lo que en Android compartían las secciones con `HomeVeterinarioActivity` (`pedirFoto`, y el panel de avisos de la
 * campana). El cascarón (`CascaronVet`) registra acá sus manejadores al montarse.
 */
class EstadoCascaronImpl {
  /** Lo registra el cascarón: abre el panel de avisos. */
  manejadorAvisos: (() => void) | null = null;
  /** Lo registra el cascarón: abre la galería y devuelve la uri elegida. */
  manejadorFoto: ((alElegir: (uri: string) => void) => void) | null = null;

  abrirAvisos(): void {
    this.manejadorAvisos?.();
  }

  /** Abre la galería y devuelve la imagen elegida (la usa el perfil para cambiar la foto). */
  pedirFoto(alElegir: (uri: string) => void): void {
    if (this.manejadorFoto) this.manejadorFoto(alElegir);
    else void elegirImagen({ editar: true, aspecto: [1, 1] }).then((uri) => uri && alElegir(uri));
  }
}

export const EstadoCascaron = new EstadoCascaronImpl();
