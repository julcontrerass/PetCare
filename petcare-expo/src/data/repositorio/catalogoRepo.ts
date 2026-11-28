/*
 * Catálogo de servicios y especialidades que maneja el administrador: se baja al arrancar la app y al entrar, y el
 * administrador lo cambia desde su panel. Si no se puede bajar, queda la lista de siempre.
 */
import { CatalogoMedico, type ItemCatalogo } from "../catalogoMedico";
import { Servicios } from "../servicios";
import { PerfilVetRepo } from "./perfilVetRepo";

class CatalogoRepoImpl {
  private cargado = false;

  get estaCargado(): boolean {
    return this.cargado;
  }

  /** Baja el catálogo; los errores se ignoran (sigue la lista que había). */
  async cargar(): Promise<void> {
    try {
      const items = await Servicios.fuente.catalogoServicios();
      if (items.length === 0) return;
      CatalogoMedico.aplicar(items);
      PerfilVetRepo.sincronizarCatalogo();
      this.cargado = true;
      Servicios.avisarCambio();
    } catch {
      // sin conexión o sin la tabla: queda la lista de siempre
    }
  }

  /** El administrador agrega un servicio o especialidad, o cambia la duración o si está activo. */
  async guardar(item: ItemCatalogo): Promise<void> {
    await Servicios.fuente.guardarServicioCatalogo(item.nombre, item.tipo, item.duracion_min, item.activo);
    await this.cargar();
  }
}

export const CatalogoRepo = new CatalogoRepoImpl();
