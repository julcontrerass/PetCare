/* Migrado de data/Sesion.kt. */
import type { PerfilDto } from "./remoto/dtos";
import { CuentaActual, type Rol } from "./cuentaActual";
import { AvisosDelSistema } from "./avisos/avisosDelSistema";
import { Recordatorios, Manual } from "./avisos/recordatorios";
import { AdminRepo } from "./repositorio/adminRepo";
import { AgendaRepo } from "./repositorio/agendaRepo";
import { ArchivosRepo } from "./repositorio/archivosRepo";
import { DuenoRepo } from "./repositorio/duenoRepo";
import { InformesRepo } from "./repositorio/informesRepo";
import { NotificacionesVet } from "./repositorio/notificacionesVet";
import { PacientesRepo } from "./repositorio/pacientesRepo";
import { PerfilVetRepo } from "./repositorio/perfilVetRepo";
import { PrescripcionesRepo } from "./repositorio/prescripcionesRepo";
import { RecepcionAgendaRepo } from "./repositorio/recepcionAgendaRepo";
import { RecepcionRepo } from "./repositorio/recepcionRepo";
import { RecordatoriosRepo } from "./repositorio/recordatoriosRepo";
import { SaludRepo } from "./repositorio/saludRepo";
import { SolicitudesRepo } from "./repositorio/solicitudesRepo";
import { FotosPendientes } from "./fotosPendientes";
import { Imagenes } from "./imagenes";
import { Servicios } from "./servicios";

const TIEMPO_CIERRE_MS = 4_000;

export type { Rol } from "./cuentaActual";

/** La cuenta puede usar la app y sus datos ya están cargados. */
export interface ResultadoListo {
  tipo: "listo";
  rol: Rol;
}

/** La cuenta existe pero no puede ingresar (en revisión, rechazada o suspendida). */
export interface ResultadoBloqueada {
  tipo: "bloqueada";
  mensaje: string;
}

/** La cuenta es dueño y veterinario a la vez: hay que elegir cómo ingresar con [Sesion.entrarComo]. */
export interface ResultadoElegir {
  tipo: "elegir";
  roles: Rol[];
}

export type Resultado = ResultadoListo | ResultadoBloqueada | ResultadoElegir;

function mensajeDeBloqueo(p: PerfilDto): string | null {
  const detalle = p.motivo_estado && p.motivo_estado.trim() !== "" ? `\n\nMotivo: ${p.motivo_estado}` : "";
  switch (p.estado) {
    case "pendiente_revision":
      return "Tu cuenta está en revisión. El administrador tiene que verificar tu matrícula antes de darte el alta.";
    case "rechazado":
      return `El administrador rechazó tu solicitud de alta.${detalle}`;
    case "suspendido":
      return `El administrador suspendió tu cuenta.${detalle}`;
    default:
      return null;
  }
}

/**
 * Modos en los que puede usarse la cuenta. Todo veterinario puede ser también dueño de sus mascotas; un dueño
 * suma el modo veterinario cuando el administrador aprueba su alta.
 */
function rolesDe(datos: PerfilDto): Rol[] {
  if (datos.rol === "admin") return ["ADMIN"];
  if (datos.rol === "veterinario") return ["VETERINARIO", "DUENO"];
  return datos.veterinarios?.estado_revision === "activo" ? ["DUENO", "VETERINARIO"] : ["DUENO"];
}

/** Espera [accion] como máximo [ms] milisegundos (como withTimeoutOrNull). */
async function conTope(ms: number, accion: () => Promise<void>): Promise<void> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<void>((resolver) => {
    temporizador = setTimeout(resolver, ms);
  });
  try {
    await Promise.race([accion(), tope]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

/** Esperas en curso (el retraso de las recargas y del aviso de sin leer): se cortan al olvidar la sesión. */
const esperas = new Set<{ temporizador: ReturnType<typeof setTimeout>; resolver: () => void }>();

/** Espera [ms] milisegundos sin mantener vivo el proceso; [cortarEsperas] la termina antes de tiempo. */
function dormir(ms: number): Promise<void> {
  return new Promise<void>((resolver) => {
    const espera = {
      temporizador: setTimeout(() => {
        esperas.delete(espera);
        resolver();
      }, ms),
      resolver,
    };
    (espera.temporizador as unknown as { unref?: () => void }).unref?.();
    esperas.add(espera);
  });
}

function cortarEsperas(): void {
  for (const e of [...esperas]) {
    clearTimeout(e.temporizador);
    e.resolver();
  }
  esperas.clear();
}

/** Cuánto esperar antes de avisar de las notificaciones sin leer: da tiempo a que se abra la pantalla principal. */
const ESPERA_AVISO_SIN_LEER_MS = 1500;

/** La cuenta que tiene la sesión iniciada y la carga de sus datos desde el servidor. */
class SesionImpl {
  // El id y el modo viven en CuentaActual para que los repositorios los lean sin importar Sesion
  private _perfil: PerfilDto | null = null;
  private _rolesDisponibles: Rol[] = [];

  /**
   * La interfaz se anota acá para mostrar un aviso en pantalla (Kotlin: `Avisos.mostrar(null, mensaje)`).
   */
  alAvisar: ((mensaje: string) => void) | null = null;

  /**
   * La interfaz se anota acá para abrir el ingreso como única pantalla (Kotlin: abrir `AuthActivity` limpiando
   * la pila); en general `router.replace("/auth")`.
   */
  alVolverAlIngreso: (() => void) | null = null;

  get usuarioId(): string | null {
    return CuentaActual.usuarioId;
  }
  get rol(): Rol | null {
    return CuentaActual.rol;
  }
  get perfil(): PerfilDto | null {
    return this._perfil;
  }

  /**
   * Modos en los que se puede usar la cuenta (dueño, veterinario, recepción). La recepción se suma también si
   * la cuenta acepta o pide un vínculo después de ingresar.
   */
  get rolesDisponibles(): Rol[] {
    const roles = this._rolesDisponibles;
    if (roles.length > 0 && !roles.includes("ADMIN") && !roles.includes("RECEPCIONISTA") && RecepcionRepo.misVeterinarios.length > 0) {
      return [...roles, "RECEPCIONISTA"];
    }
    return roles;
  }

  get activa(): boolean {
    return CuentaActual.usuarioId != null;
  }

  /** Id de la sesión abierta en el servidor, aunque todavía no se hayan cargado los datos de la cuenta. */
  async usuarioIdActual(): Promise<string | null> {
    return Servicios.fuente.restaurarSesion();
  }

  /** Intenta retomar la sesión guardada en el dispositivo; devuelve null si no hay ninguna. */
  async restaurar(): Promise<Resultado | null> {
    const id = await Servicios.fuente.restaurarSesion();
    if (id == null) return null;
    try {
      return await this.cargar(id);
    } catch {
      // Sin conexión no se puede saber si la cuenta sigue vigente: se vuelve a pedir el ingreso.
      return null;
    }
  }

  async ingresar(email: string, password: string): Promise<Resultado> {
    const id = await Servicios.fuente.ingresar(email, password);
    return this.cargar(id);
  }

  /** Se usa después de crear una cuenta cuando Supabase ya dejó la sesión abierta. */
  continuarTrasRegistro(id: string): Promise<Resultado> {
    return this.cargar(id);
  }

  private async cargar(id: string): Promise<Resultado> {
    let datos = await Servicios.fuente.miPerfil();
    CuentaActual.usuarioId = id;
    this._perfil = datos;
    try {
      await FotosPendientes.subirCredencial(datos.email, id);
    } catch {
      // se vuelve a intentar en el próximo ingreso
    }
    const bloqueo = mensajeDeBloqueo(datos);
    if (bloqueo != null) {
      await this.cerrar();
      return { tipo: "bloqueada", mensaje: bloqueo };
    }
    // Primer ingreso después de registrarse: se suben las fotos que se eligieron en el registro
    let subieron = false;
    try {
      subieron = await FotosPendientes.subir(datos.email, id);
    } catch {
      subieron = false;
    }
    if (subieron) {
      datos = await Servicios.fuente.miPerfil();
      this._perfil = datos;
    }
    const roles = rolesDe(datos);
    if (datos.rol !== "admin") {
      // Quien trabaja (o pidió trabajar) en la recepción de un veterinario suma ese modo
      await RecepcionRepo.cargar();
      if (RecepcionRepo.misVeterinarios.length > 0) roles.push("RECEPCIONISTA");
    }
    this._rolesDisponibles = roles;
    // Con dos modos posibles se pregunta cómo ingresar antes de cargar los datos de uno de ellos. A un veterinario
    // solo se le pregunta si ya tiene mascotas propias; si no, entra directo (desde su perfil puede pasar a dueño).
    // Lo mismo con la recepción: quien solo es dueño y recepcionista, sin mascotas propias, entra a la recepción.
    const sinMascotas = roles.length > 1 && !(await this.tieneMascotas());
    if (sinMascotas && datos.rol === "veterinario" && !roles.includes("RECEPCIONISTA")) return this.entrarComo("VETERINARIO");
    if (sinMascotas && roles.length === 2 && roles.includes("RECEPCIONISTA")) return this.entrarComo("RECEPCIONISTA");
    if (roles.length > 1) return { tipo: "elegir", roles };
    return this.entrarComo(roles[0]);
  }

  private async tieneMascotas(): Promise<boolean> {
    try {
      return (await Servicios.fuente.misMascotas()).length > 0;
    } catch {
      return false;
    }
  }

  /** Carga los datos del modo elegido y deja la sesión lista para usarse en él. */
  async entrarComo(rolElegido: Rol): Promise<ResultadoListo> {
    const datos = this._perfil;
    if (!datos) throw new Error("No hay una sesión abierta");
    if (!this.rolesDisponibles.includes(rolElegido)) {
      throw new Error(`La cuenta no puede ingresar como ${rolElegido}`);
    }
    switch (rolElegido) {
      case "DUENO":
        await DuenoRepo.cargar(datos);
        break;
      case "VETERINARIO":
        await PerfilVetRepo.cargar(datos);
        await this.recargarVeterinario(true);
        break;
      case "RECEPCIONISTA":
        // La agenda sale de los vínculos: primero se piden ellos
        await RecepcionRepo.cargar();
        await RecepcionAgendaRepo.cargar();
        break;
      case "ADMIN":
        await AdminRepo.cargar();
        break;
    }
    if (rolElegido === "DUENO" || rolElegido === "VETERINARIO") await RecepcionRepo.cargar();
    CuentaActual.rol = rolElegido;
    this.escucharCambios(rolElegido);
    Recordatorios.vigilarAvisos();
    this.avisarSiHayAvisosSinLeer(rolElegido);
    return { tipo: "listo", rol: rolElegido };
  }

  /** Pasa de un modo al otro sin cerrar la sesión: se descartan los datos del anterior y se cargan los nuevos. */
  async cambiarModo(nuevo: Rol): Promise<ResultadoListo> {
    const roles = this.rolesDisponibles;
    if (!roles.includes(nuevo)) throw new Error(`La cuenta no puede ingresar como ${nuevo}`);
    // Se fijan antes de descartar los datos: la recepción sale de los vínculos, que también se descartan
    this._rolesDisponibles = roles;
    this.descartarDatosDelModo();
    return this.entrarComo(nuevo);
  }

  /** Vuelve a pedir el perfil: sirve para enterarse de que el rol de veterinario fue aprobado. */
  async actualizarRoles(): Promise<void> {
    const datos = await Servicios.fuente.miPerfil();
    this._perfil = datos;
    this._rolesDisponibles = rolesDe(datos);
  }

  /**
   * Lo que llegó mientras la cuenta no estaba abierta no suena (ya pasó), pero se avisa que hay avisos sin leer
   * para que no queden escondidos en la campana.
   */
  private avisarSiHayAvisosSinLeer(rolCuenta: Rol): void {
    let cantidad = 0;
    switch (rolCuenta) {
      case "DUENO":
        cantidad = DuenoRepo.notificaciones.filter((n) => !n.leida).length;
        break;
      case "VETERINARIO":
        cantidad = NotificacionesVet.sinLeer;
        break;
      case "RECEPCIONISTA":
      case "ADMIN":
        cantidad = 0;
        break;
    }
    if (cantidad === 0) return;
    // Da tiempo a que se abra la pantalla principal, que es donde tiene que verse
    const generacion = this.generacionEscucha;
    void dormir(ESPERA_AVISO_SIN_LEER_MS).then(() => {
      // Si mientras tanto se cerró la sesión, ya no corresponde avisar
      if (generacion !== this.generacionEscucha) return;
      this.alAvisar?.(cantidad === 1 ? "Tenés 1 notificación sin leer" : `Tenés ${cantidad} notificaciones sin leer`);
    });
  }

  /** Corta la escucha de cambios del servidor (null si no hay ninguna). */
  private cortarEscucha: (() => void) | null = null;
  /** Sube con cada escucha nueva o cancelada: lo que estaba en curso con otro número se descarta. */
  private generacionEscucha = 0;

  /**
   * Mientras hay sesión se escuchan los cambios del servidor y se vuelven a pedir los datos al instante, así
   * un turno nuevo, una cancelación o un informe aparecen sin esperar ni tocar nada.
   */
  private escucharCambios(rolCuenta: Rol): void {
    this.detenerEscucha();
    const generacion = this.generacionEscucha;
    let procesando = false;
    let pendiente = false;
    const procesar = async () => {
      procesando = true;
      try {
        do {
          pendiente = false;
          // Si llegan varios cambios seguidos (un turno y su aviso) se piden los datos una sola vez
          await dormir(rolCuenta === "ADMIN" ? 1500 : 300);
          if (generacion !== this.generacionEscucha) return;
          try {
            switch (rolCuenta) {
              case "DUENO":
                await DuenoRepo.recargarDerivados();
                await RecepcionRepo.cargar();
                break;
              case "VETERINARIO":
                await this.recargarVeterinario();
                await RecepcionRepo.cargar();
                break;
              case "RECEPCIONISTA":
                await RecepcionRepo.cargar();
                await RecepcionAgendaRepo.cargar();
                break;
              case "ADMIN":
                await AdminRepo.cargar();
                break;
            }
          } catch {
            // se conserva lo que había
          }
          if (generacion !== this.generacionEscucha) return;
          Servicios.avisarCambio();
        } while (pendiente);
      } finally {
        procesando = false;
      }
    };
    try {
      this.cortarEscucha = Servicios.fuente.cambios(() => {
        // Equivale a conflate(): un solo cambio queda en espera mientras se procesa el anterior
        if (procesando) pendiente = true;
        else void procesar();
      });
    } catch {
      this.cortarEscucha = null;
    }
  }

  private detenerEscucha(): void {
    this.generacionEscucha += 1;
    cortarEsperas();
    try {
      this.cortarEscucha?.();
    } catch {
      // ya estaba cortada
    }
    this.cortarEscucha = null;
  }

  /** Pide al servidor los pacientes, la agenda, el carnet y las solicitudes del veterinario. */
  async recargarVeterinario(silencioso: boolean = false): Promise<void> {
    // Los registros de salud se muestran con el nombre del paciente: primero hay que tener los pacientes
    await PacientesRepo.cargar();
    const segura = async (accion: () => Promise<void>) => {
      try {
        await accion();
      } catch {
        // estas dos cargas son opcionales
      }
    };
    await Promise.all([
      AgendaRepo.cargar(),
      SaludRepo.cargar(),
      SolicitudesRepo.cargar(),
      segura(() => NotificacionesVet.cargar(silencioso)),
      segura(() => RecordatoriosRepo.cargar()),
    ]);
    const manuales = RecordatoriosRepo.lista.map(
      (r) => new Manual(r.id, PacientesRepo.nombreDe(r.mascotaId), r.titulo, r.fecha, r.hora, r.nota),
    );
    await Recordatorios.programar([...Recordatorios.paraVeterinario(AgendaRepo.eventos), ...Recordatorios.paraManuales(manuales)]);
  }

  /** Vuelve a pedir el perfil propio después de un cambio que el servidor rechazó. */
  async recargarPerfil(): Promise<void> {
    const datos = await Servicios.fuente.miPerfil();
    this._perfil = datos;
    if (CuentaActual.rol === "VETERINARIO") await PerfilVetRepo.cargar(datos);
    else if (CuentaActual.rol === "DUENO") await DuenoRepo.cargar(datos);
    Servicios.avisarCambio();
  }

  /** Cierra la sesión en el servidor y descarta todo lo que había en memoria. */
  async cerrar(): Promise<void> {
    try {
      await Servicios.fuente.cerrarSesion();
    } catch {
      // si no se pudo avisar al servidor, igual se descarta lo local
    }
    this.olvidar();
  }

  /** Cierra la sesión y vuelve a la pantalla de ingreso, sin dejar pantallas anteriores en la pila. */
  cerrarYVolver(): Promise<void> {
    this.olvidar();
    // Se espera a que la sesión quede cerrada antes de abrir el ingreso: si no, éste la encuentra todavía
    // guardada y entra solo con la cuenta que se acaba de cerrar
    return (async () => {
      await conTope(TIEMPO_CIERRE_MS, async () => {
        try {
          await Servicios.fuente.cerrarSesion();
        } catch {
          // se sigue igual
        }
      });
      this.volverAlIngreso();
    })();
  }

  /** Descarta los datos en memoria y abre el ingreso como única pantalla. */
  volverAlIngreso(): void {
    this.olvidar();
    this.alVolverAlIngreso?.();
  }

  /**
   * Da de baja la cuenta: primero se borran del almacenamiento las fotos y archivos propios (la base no puede
   * hacerlo sola) y después se elimina el usuario con todo lo que cargó.
   */
  async eliminarCuenta(): Promise<void> {
    const f = Servicios.fuente;
    const porBucket = new Map<string, string[]>();
    for (const r of await f.rutasArchivosCuenta()) {
      const rutas = porBucket.get(r.bucket) ?? [];
      rutas.push(r.ruta);
      porBucket.set(r.bucket, rutas);
    }
    for (const [bucket, rutas] of porBucket) await f.borrar(bucket, rutas);
    await f.eliminarCuenta();
  }

  /** Descarta los datos de la cuenta anterior sin tocar el servidor (la sesión ya se cerró o venció). */
  olvidar(): void {
    this.descartarDatosDelModo();
    CuentaActual.usuarioId = null;
    this._perfil = null;
    this._rolesDisponibles = [];
    Imagenes.limpiarCache();
  }

  /** Vacía los datos del modo que se estaba usando; la sesión y el perfil siguen. */
  private descartarDatosDelModo(): void {
    void Recordatorios.cancelarTodo();
    void AvisosDelSistema.olvidar();
    this.detenerEscucha();
    CuentaActual.rol = null;
    DuenoRepo.limpiar();
    RecepcionRepo.limpiar();
    RecepcionAgendaRepo.limpiar();
    PerfilVetRepo.limpiar();
    PacientesRepo.limpiar();
    AgendaRepo.limpiar();
    SaludRepo.limpiar();
    RecordatoriosRepo.limpiar();
    ArchivosRepo.limpiar();
    InformesRepo.limpiar();
    PrescripcionesRepo.limpiar();
    SolicitudesRepo.limpiar();
    NotificacionesVet.limpiar();
    AdminRepo.limpiar();
  }
}

export const Sesion = new SesionImpl();
CuentaActual.recargarPerfil = () => Sesion.recargarPerfil();
