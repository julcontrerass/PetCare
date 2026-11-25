/*
 * Vínculos de recepción de la cuenta en sesión, de los dos lados: como veterinario (las personas que manejan su
 * agenda) y como recepcionista (los veterinarios para los que trabaja). Se cargan al entrar en cualquier modo y se
 * vuelven a pedir con cada cambio del servidor, así una invitación nueva aparece sola en el Inicio.
 */
import type { CuentaRecepcionCreadaDto, NuevaCuentaRecepcionDto, VinculoRecepcionDto } from "../remoto/dtos";
import { Servicios } from "../servicios";

class RecepcionRepoImpl {
  private _vinculos: VinculoRecepcionDto[] = [];

  /** Todos los vínculos (activos y pendientes) de los dos lados. */
  get vinculos(): readonly VinculoRecepcionDto[] { return this._vinculos; }

  /** Recepcionistas de la cuenta, cuando la cuenta es veterinaria. */
  get miRecepcion(): VinculoRecepcionDto[] { return this._vinculos.filter((v) => v.soy === "veterinario"); }

  /** Veterinarios para los que trabaja la cuenta (o con los que tiene un pedido pendiente). */
  get misVeterinarios(): VinculoRecepcionDto[] { return this._vinculos.filter((v) => v.soy === "recepcionista"); }

  /** Invitaciones de un veterinario que la cuenta todavía no respondió (se muestran en el Inicio). */
  get invitacionesRecibidas(): VinculoRecepcionDto[] {
    return this._vinculos.filter((v) => v.soy === "recepcionista" && v.me_toca_responder);
  }

  /** Pedidos de personas que quieren ser recepcionistas del veterinario y esperan su respuesta. */
  get pedidosRecibidos(): VinculoRecepcionDto[] {
    return this._vinculos.filter((v) => v.soy === "veterinario" && v.me_toca_responder);
  }

  /** Si falla el pedido se quedan los vínculos que había. */
  async cargar(): Promise<void> {
    try {
      this._vinculos = await Servicios.fuente.misVinculosRecepcion();
    } catch {
      // se queda lo que había
    }
  }

  /** Devuelve "pendiente" (espera la respuesta de la otra persona) o "activo" (ella ya lo había pedido). */
  async invitar(dniOCorreo: string): Promise<string> {
    const estado = await Servicios.fuente.invitarRecepcionista(dniOCorreo.trim());
    await this.recargar();
    return estado;
  }

  /** Igual que [invitar], desde el lado de quien quiere ser recepcionista. */
  async pedir(dato: string): Promise<string> {
    const estado = await Servicios.fuente.pedirSerRecepcionista(dato.trim());
    await this.recargar();
    return estado;
  }

  async responder(vinculo: VinculoRecepcionDto, aceptar: boolean): Promise<void> {
    await Servicios.fuente.responderVinculoRecepcion(vinculo.id, aceptar);
    await this.recargar();
  }

  async quitar(vinculo: VinculoRecepcionDto): Promise<void> {
    await Servicios.fuente.quitarVinculoRecepcion(vinculo.id);
    await this.recargar();
  }

  /** El veterinario crea la cuenta de una persona de su recepción; devuelve el correo y la contraseña temporal. */
  async crearCuenta(datos: NuevaCuentaRecepcionDto): Promise<CuentaRecepcionCreadaDto> {
    const creada = await Servicios.fuente.crearCuentaRecepcionista({
      nombre: datos.nombre.trim(), dni: datos.dni.trim(), telefono: datos.telefono.trim(), email: datos.email.trim().toLowerCase(),
    });
    await this.recargar();
    return creada;
  }

  limpiar(): void {
    this._vinculos = [];
  }

  private async recargar(): Promise<void> {
    await this.cargar();
    Servicios.avisarCambio();
  }
}

export const RecepcionRepo = new RecepcionRepoImpl();
