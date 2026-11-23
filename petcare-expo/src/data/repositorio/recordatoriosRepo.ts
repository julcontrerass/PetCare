/* Migrado de data/repositorio/RecordatoriosRepo.kt */
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import type { RecordatorioDto } from "../remoto/dtos";
import { Servicios } from "../servicios";
import { Sesion } from "../sesion";

/** Un recordatorio hecho a mano. [creadoPor] distingue los propios de los que dejó el veterinario. */
export class RecordatorioManual {
  constructor(
    readonly id: string,
    readonly mascotaId: string,
    public titulo: string,
    public tipo: string,
    public fecha: LocalDate,
    /** "HH:mm" o null si es para todo el día. */
    public hora: string | null,
    public nota: string,
    readonly creadoPor: string,
  ) {}

  get esMio(): boolean {
    return this.creadoPor === Sesion.usuarioId;
  }
}

const primeraEnMayuscula = (s: string) => (s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1));

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Recordatorios que crea el propio usuario (el dueño para su mascota, el veterinario para un paciente). El dueño
 * también ve los que le deja su veterinario, pero solo los puede editar quien los creó.
 */
class RecordatoriosRepoImpl {
  readonly TIPOS = ["Vacuna", "Control", "Medicación", "Higiene", "Otro"];

  private items: RecordatorioManual[] = [];

  /** Todos, el más próximo primero. */
  get lista(): RecordatorioManual[] {
    return [...this.items].sort((a, b) => a.fecha.compareTo(b.fecha) || comparar(a.hora ?? "", b.hora ?? ""));
  }

  deMascota(mascotaId: string): RecordatorioManual[] {
    return this.lista.filter((r) => r.mascotaId === mascotaId);
  }

  limpiar(): void {
    this.items = [];
  }

  private aModelo(d: RecordatorioDto): RecordatorioManual {
    return new RecordatorioManual(
      d.id, d.mascota_id, d.titulo, primeraEnMayuscula(d.tipo),
      Fechas.iso(d.fecha) ?? LocalDate.now(), d.hora != null ? d.hora.slice(0, 5) : null, d.nota ?? "", d.creado_por,
    );
  }

  async cargar(): Promise<void> {
    this.items = (await Servicios.fuente.recordatorios()).map((d) => this.aModelo(d));
  }

  private async recargar(): Promise<void> {
    try {
      await this.cargar();
    } catch {
      // se queda lo que había
    }
    Servicios.avisarCambio();
  }

  crear(mascotaId: string, titulo: string, tipo: string, fecha: LocalDate, hora: string | null, nota: string): RecordatorioManual {
    const id = nuevoId();
    const usuario = Sesion.usuarioId;
    if (!usuario) throw new Error("No hay una sesión iniciada");
    const nuevo = new RecordatorioManual(id, mascotaId, titulo, tipo, fecha, hora, nota, usuario);
    this.items.push(nuevo);
    void Servicios.escribir({ alFallar: () => this.recargar() }, async () => {
      await Servicios.fuente.crearRecordatorio({
        id, mascota_id: mascotaId, creado_por: usuario, titulo, tipo: tipo.toLowerCase(),
        fecha: fecha.toString(), hora: hora != null ? `${hora}:00` : null, nota: nota.trim() === "" ? null : nota,
      });
    });
    return nuevo;
  }

  editar(r: RecordatorioManual, titulo: string, tipo: string, fecha: LocalDate, hora: string | null, nota: string): void {
    if (!r.esMio) return;
    r.titulo = titulo;
    r.tipo = tipo;
    r.fecha = fecha;
    r.hora = hora;
    r.nota = nota;
    void Servicios.escribir({ alFallar: () => this.recargar() }, async () => {
      await Servicios.fuente.actualizarRecordatorio(r.id, {
        titulo,
        tipo: tipo.toLowerCase(),
        fecha: fecha.toString(),
        hora: hora != null ? `${hora}:00` : null,
        nota: nota.trim() === "" ? null : nota,
      });
    });
  }

  borrar(r: RecordatorioManual): void {
    if (!r.esMio) return;
    const i = this.items.indexOf(r);
    if (i >= 0) this.items.splice(i, 1);
    void Servicios.escribir({ alFallar: () => this.recargar() }, async () => {
      await Servicios.fuente.borrarRecordatorio(r.id);
    });
  }
}

export const RecordatoriosRepo = new RecordatoriosRepoImpl();
