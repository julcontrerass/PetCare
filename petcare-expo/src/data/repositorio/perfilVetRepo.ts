import type { SedeVet } from "../../model/modelos";
import { crearSede } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import type { Profesional } from "../../ui/common/Documentos";
import { nuevoId } from "../../util/uuid";
import { CatalogoMedico } from "../catalogoMedico";
import { Imagenes } from "../imagenes";
import type { JsonObject, NuevaSedeDto, PerfilDto } from "../remoto/dtos";
import { lugaresDe, normalizarVeterinario } from "../remoto/dtos";
import { Servicios } from "../servicios";
import { CuentaActual } from "../cuentaActual";

const sinVacio = (s: string): string | null => (s.trim() ? s : null);

/** Días de atención sin repetir y en orden (lunes = 1 ... domingo = 7). */
const diasOrdenados = (sede: SedeVet): number[] => [...new Set(sede.dias)].sort((a, b) => a - b);

/** Perfil del veterinario en sesión. */
class PerfilVetRepoImpl {
  nombre = "";
  dni = "";
  matricula = "";
  clinica = "";
  direccionClinica = "";
  telefono = "";
  email = "";
  fotoPath: string | null = null;
  /** Foto elegida en este teléfono (uri `file://` o `content://`); se muestra mientras se sube. */
  fotoUri: string | null = null;

  // Días y horarios del lugar principal (los demás lugares están en [sedes])
  readonly todosLosDias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  readonly diasSeleccionados: boolean[] = new Array<boolean>(7).fill(false);
  horaApertura = "09:00";
  horaCierre = "18:00";

  /** Lugares donde atiende, el principal primero; cada uno tiene sus propios días y horarios. */
  readonly sedes: SedeVet[] = [];

  /** Cuántos lugares puede tener como máximo (el servidor aplica el mismo tope). */
  readonly MAX_SEDES = 3;

  /** El lugar con ese id; si no se indica (o ya no existe) el principal. */
  sede(id: string | null | undefined): SedeVet | null {
    return this.sedes.find((s) => s.id === id) ?? this.sedes[0] ?? null;
  }

  /** Lo "de siempre" (clínica, dirección, días y horario) refleja el lugar principal. */
  private reflejarPrincipal(): void {
    const principal = this.sedes[0];
    if (!principal) return;
    this.clinica = principal.nombre;
    this.direccionClinica = principal.direccion;
    this.diasSeleccionados.fill(false);
    for (const d of principal.dias) {
      if (d >= 1 && d <= 7) this.diasSeleccionados[d - 1] = true;
    }
    this.horaApertura = principal.apertura;
    this.horaCierre = principal.cierre;
  }

  private sedeNueva(id: string, sede: SedeVet): NuevaSedeDto {
    return {
      id,
      veterinario_id: CuentaActual.usuarioId ?? "",
      nombre: sede.nombre,
      direccion: sinVacio(sede.direccion),
      dias_atencion: diasOrdenados(sede),
      hora_apertura: `${sede.apertura}:00`,
      hora_cierre: `${sede.cierre}:00`,
      pausa_desde: sede.pausaDesde ? `${sede.pausaDesde}:00` : null,
      pausa_hasta: sede.pausaHasta ? `${sede.pausaHasta}:00` : null,
      servicios: sede.servicios,
    };
  }

  private readonly recargarAlFallar = async (): Promise<void> => {
    await CuentaActual.recargarPerfil();
  };

  agregarSede(sede: SedeVet): SedeVet | null {
    if (this.sedes.length >= this.MAX_SEDES) return null;
    const nueva: SedeVet = { ...sede, id: nuevoId() };
    this.sedes.push(nueva);
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      await Servicios.fuente.crearSede(this.sedeNueva(nueva.id, nueva));
    });
    return nueva;
  }

  guardarSede(sede: SedeVet): void {
    const i = this.sedes.findIndex((s) => s.id === sede.id);
    if (i < 0) return;
    this.sedes[i] = sede;
    if (i === 0) this.reflejarPrincipal();
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      if (!sede.id.trim()) {
        // Todavía sin lugares propios en el servidor: se guardan los datos "de siempre" del veterinario
        await Servicios.fuente.actualizarVeterinario({
          clinica: sede.nombre,
          direccion_clinica: sinVacio(sede.direccion),
          dias_atencion: diasOrdenados(sede),
          hora_apertura: `${sede.apertura}:00`,
          hora_cierre: `${sede.cierre}:00`,
        });
      } else {
        await Servicios.fuente.actualizarSede(sede.id, {
          nombre: sede.nombre,
          direccion: sinVacio(sede.direccion),
          dias_atencion: diasOrdenados(sede),
          hora_apertura: `${sede.apertura}:00`,
          hora_cierre: `${sede.cierre}:00`,
          pausa_desde: sede.pausaDesde ? `${sede.pausaDesde}:00` : null,
          pausa_hasta: sede.pausaHasta ? `${sede.pausaHasta}:00` : null,
          servicios: sede.servicios,
        });
      }
    });
  }

  /** Quita un lugar. El servidor no deja borrar el único ni uno que todavía tiene turnos pendientes. */
  eliminarSede(id: string): void {
    if (this.sedes.length <= 1) return;
    for (let i = this.sedes.length - 1; i >= 0; i--) {
      if (this.sedes[i].id === id) this.sedes.splice(i, 1);
    }
    this.reflejarPrincipal();
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      await Servicios.fuente.eliminarSede(id);
    });
  }

  textoHorarios(): string {
    const diasActivos = this.todosLosDias.filter((_, index) => this.diasSeleccionados[index]);
    if (diasActivos.length === 0) return "Sin días de atención configurados";
    return `${diasActivos.join(", ")} · ${this.horaApertura} a ${this.horaCierre} hs`;
  }

  // Especialidades y prácticas
  readonly todasLasEspecialidades: string[] = [...CatalogoMedico.TODAS];
  readonly especialidadesSeleccionadas: boolean[] = new Array<boolean>(CatalogoMedico.TODAS.length).fill(false);

  textoEspecialidades(): string {
    const activas = this.todasLasEspecialidades.filter((_, index) => this.especialidadesSeleccionadas[index]);
    return activas.length === 0 ? "Sin especialidades seleccionadas" : activas.join(", ");
  }

  // Tipos de animal que atiende (conserva el orden en que se agregaron)
  readonly tiposAnimales = new Set<string>();

  /** True si atiende mascotas de ese tipo (lo que no tiene nombre propio cuenta como "Otro"). */
  atiende(tipoMascota: string | null | undefined): boolean {
    return this.tiposAnimales.has(TiposMascota.normalizar(tipoMascota));
  }

  textoTiposAnimales(): string {
    const activos = TiposMascota.TODOS.filter((t) => this.tiposAnimales.has(t));
    return activos.length === 0
      ? "Sin tipos de animales seleccionados"
      : activos.map((t) => TiposMascota.plural(t)).join(", ");
  }

  // Minutos que dura cada servicio; lo que no está cargado usa la duración por defecto del catálogo
  readonly duraciones: Record<string, number> = {};

  duracionDe(servicio: string | null | undefined): number {
    const buscado = servicio?.trim().toLowerCase();
    const par = buscado === undefined ? undefined : Object.entries(this.duraciones).find(([k]) => k.toLowerCase() === buscado);
    if (par) return Math.min(CatalogoMedico.DURACION_MAXIMA_MIN, Math.max(CatalogoMedico.DURACION_MINIMA_MIN, par[1]));
    return CatalogoMedico.duracionPorDefecto(servicio);
  }

  /**
   * Rearma la lista para elegir con el catálogo actual (lo maneja el administrador). Las que ya tenía elegidas siguen
   * en la lista aunque ya no estén en el catálogo, así se ven y se pueden sacar.
   */
  sincronizarCatalogo(elegidas: readonly string[] = this.serviciosOfrecidos()): void {
    const lista = [...CatalogoMedico.TODAS];
    for (const e of elegidas) if (!lista.includes(e)) lista.push(e);
    this.todasLasEspecialidades.splice(0, this.todasLasEspecialidades.length, ...lista);
    this.especialidadesSeleccionadas.splice(0, this.especialidadesSeleccionadas.length, ...lista.map((e) => elegidas.includes(e)));
  }

  /** Servicios y especialidades que el veterinario marcó como propios. */
  serviciosOfrecidos(): string[] {
    return this.todasLasEspecialidades.filter((_, index) => this.especialidadesSeleccionadas[index]);
  }

  textoDuraciones(): string {
    const servicios = this.serviciosOfrecidos();
    if (servicios.length === 0) return "Primero elegí tus especialidades y prácticas";
    const minutos = servicios.map((s) => this.duracionDe(s));
    const corto = CatalogoMedico.textoDuracion(Math.min(...minutos));
    const largo = CatalogoMedico.textoDuracion(Math.max(...minutos));
    const cantidad = servicios.length === 1 ? "1 servicio" : `${servicios.length} servicios`;
    return corto === largo ? `${cantidad} · ${corto} cada uno` : `${cantidad} · de ${corto} a ${largo}`;
  }

  /** Avisos que el veterinario quiere recibir; lo que no está cargado se considera activado. */
  readonly preferencias: Record<string, boolean> = {};

  preferencia(clave: string): boolean {
    return this.preferencias[clave] ?? true;
  }

  guardarPreferencias(): void {
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      await Servicios.fuente.actualizarPerfil({ preferencias: { ...this.preferencias } });
    });
  }

  private vaciarRegistro(registro: Record<string, unknown>): void {
    for (const clave of Object.keys(registro)) delete registro[clave];
  }

  limpiar(): void {
    this.vaciarRegistro(this.preferencias);
    this.nombre = "";
    this.dni = "";
    this.matricula = "";
    this.clinica = "";
    this.direccionClinica = "";
    this.telefono = "";
    this.email = "";
    this.fotoPath = null;
    this.fotoUri = null;
    this.diasSeleccionados.fill(false);
    this.sedes.length = 0;
    this.especialidadesSeleccionadas.fill(false);
    this.tiposAnimales.clear();
    this.vaciarRegistro(this.duraciones);
    this.horaApertura = "09:00";
    this.horaCierre = "18:00";
  }

  /** Copia al repositorio lo que dice el servidor sobre el veterinario en sesión. */
  cargar(p: PerfilDto): void {
    const v = normalizarVeterinario(p.veterinarios);
    this.nombre = p.nombre;
    this.email = p.email;
    this.telefono = p.telefono ?? "";
    this.dni = p.perfiles_privados?.dni ?? "";
    this.fotoPath = p.foto_path ?? null;
    this.matricula = v?.matricula ?? "";
    this.clinica = v?.clinica ?? "";
    this.direccionClinica = v?.direccion_clinica ?? "";
    this.vaciarRegistro(this.preferencias);
    for (const [clave, valor] of Object.entries(p.preferencias ?? {})) {
      // Igual que booleanOrNull de Kotlin: un booleano, o el texto "true" / "false"
      if (typeof valor === "boolean") this.preferencias[clave] = valor;
      else if (valor === "true") this.preferencias[clave] = true;
      else if (valor === "false") this.preferencias[clave] = false;
    }
    this.diasSeleccionados.fill(false);
    for (const d of v?.dias_atencion ?? []) {
      if (d >= 1 && d <= 7) this.diasSeleccionados[d - 1] = true;
    }
    this.horaApertura = (v?.hora_apertura ?? "09:00").slice(0, 5);
    this.horaCierre = (v?.hora_cierre ?? "18:00").slice(0, 5);
    this.sedes.length = 0;
    for (const lugar of v ? lugaresDe(v) : []) {
      this.sedes.push(
        crearSede({
          id: lugar.id,
          nombre: lugar.nombre,
          direccion: lugar.direccion ?? "",
          dias: [...new Set(lugar.dias_atencion)],
          apertura: lugar.hora_apertura.slice(0, 5),
          cierre: lugar.hora_cierre.slice(0, 5),
          pausaDesde: lugar.pausa_desde ? lugar.pausa_desde.slice(0, 5) : null,
          pausaHasta: lugar.pausa_hasta ? lugar.pausa_hasta.slice(0, 5) : null,
          servicios: lugar.servicios ?? null,
        }),
      );
    }
    this.reflejarPrincipal();
    this.sincronizarCatalogo(v?.especialidades ?? []);
    this.tiposAnimales.clear();
    for (const t of v?.tipos_animales ?? TiposMascota.TODOS) this.tiposAnimales.add(TiposMascota.normalizar(t));
    this.vaciarRegistro(this.duraciones);
    if (v) Object.assign(this.duraciones, v.duraciones);
  }

  /** Guarda los datos personales y de la clínica; se muestran ya y se mandan al servidor en segundo plano. */
  guardarDatos(): void {
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      await Servicios.fuente.actualizarPerfil({
        nombre: this.nombre,
        telefono: sinVacio(this.telefono),
      });
      await Servicios.fuente.actualizarVeterinario({
        matricula: this.matricula,
      });
    });
  }

  guardarEspecialidades(): void {
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      const cambios: JsonObject = {
        especialidades: this.todasLasEspecialidades.filter((_, i) => this.especialidadesSeleccionadas[i]),
      };
      await Servicios.fuente.actualizarVeterinario(cambios);
    });
  }

  /** Los datos con los que se firman las recetas y los certificados. */
  comoProfesional(sedeId: string | null = null): Profesional {
    // El encabezado lleva el lugar donde fue el turno; sin turno (o sin lugar) el principal
    const encontrada = this.sede(sedeId);
    const lugar = encontrada && encontrada.nombre.trim() ? encontrada : null;
    return {
      nombre: this.nombre,
      matricula: this.matricula,
      clinica: lugar?.nombre ?? this.clinica,
      direccion: lugar?.direccion ?? this.direccionClinica,
      telefono: this.telefono,
    };
  }

  guardarTiposAnimales(): void {
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      await Servicios.fuente.actualizarVeterinario({
        tipos_animales: TiposMascota.TODOS.filter((t) => this.tiposAnimales.has(t)),
      });
    });
  }

  guardarDuraciones(): void {
    void Servicios.escribir({ alFallar: this.recargarAlFallar }, async () => {
      await Servicios.fuente.actualizarVeterinario({ duraciones: { ...this.duraciones } });
    });
  }

  /** [uri] es la foto elegida (`file://` o `content://`); se muestra ya y se sube en segundo plano. */
  cambiarFoto(uri: string): void {
    const anterior = this.fotoPath;
    this.fotoUri = uri;
    void Servicios.escribir(async () => {
      const usuario = CuentaActual.usuarioId;
      if (usuario == null) return;
      const ruta = await Imagenes.subirFoto(await Imagenes.prepararFoto(uri), usuario);
      await Servicios.fuente.actualizarPerfil({ foto_path: ruta });
      this.fotoPath = ruta;
      await Imagenes.borrarFoto(anterior);
    });
  }
}

export const PerfilVetRepo = new PerfilVetRepoImpl();
