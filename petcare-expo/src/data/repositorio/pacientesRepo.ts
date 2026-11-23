import type { EstadoMascota } from "../../model/modelos";
import { estadoMascotaDeClave } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import type { DatosPaciente } from "../../ui/common/Documentos";
import { Fechas } from "../../util/fechas";
import { LocalDate, periodoEntre } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import type { MascotaDto, MascotaParaCuentaDto, NuevaCuentaDuenoDto, NuevaMascotaDto } from "../remoto/dtos";
import { Servicios } from "../servicios";

const SIN_DATOS = "Sin datos";

export interface Paciente {
  readonly id: string;
  readonly nombre: string;
  readonly especie: string;
  readonly raza: string;
  readonly sexo: string;
  readonly nacimiento: string;
  readonly fotoPath: string | null;
  readonly peso: string;
  readonly microchip: string;
  readonly color: string;
  readonly observaciones: string;
  readonly propietario: string;
  readonly direccion: string;
  readonly telefono: string;
  readonly email: string;
  /** Alergias, carácter y condiciones a tener en cuenta en cada consulta. */
  readonly alertas: string;
  /** Falso cuando el dueño todavía no usa la app: la mascota está a nombre del veterinario. */
  readonly tieneCuenta: boolean;
  /** DNI del propietario cuando se cargó a mano; sirve para crearle la cuenta. */
  readonly dniPropietario: string;
  /** Foto de perfil del dueño cuando tiene cuenta (ruta en el bucket `fotos`). */
  readonly fotoDueno: string | null;
  readonly estado: EstadoMascota;
}

export function crearPaciente(
  p: Partial<Paciente> &
    Pick<
      Paciente,
      | "id" | "nombre" | "especie" | "raza" | "sexo" | "nacimiento" | "fotoPath" | "peso" | "microchip" | "color"
      | "observaciones" | "propietario" | "direccion" | "telefono" | "email"
    >,
): Paciente {
  return {
    ...p,
    alertas: p.alertas ?? "",
    tieneCuenta: p.tieneCuenta ?? true,
    dniPropietario: p.dniPropietario ?? "",
    fotoDueno: p.fotoDueno ?? null,
    estado: p.estado ?? "ACTIVA",
  };
}

/** "Perro - Macho" (raza y sexo). */
export function razaYSexo(p: Paciente): string {
  return `${p.raza} - ${p.sexo}`;
}

/** Para turnos nuevos: las inactivas y las fallecidas no se agendan. */
export function estaActiva(p: Paciente): boolean {
  return p.estado === "ACTIVA";
}

/** La ficha tal como se imprime en una receta o un certificado (sin los "Sin datos"). */
export function comoDocumento(p: Paciente): DatosPaciente {
  return {
    nombre: p.nombre,
    especie: p.especie,
    raza: p.raza !== p.especie ? p.raza : "",
    sexo: p.sexo !== SIN_DATOS ? p.sexo : "",
    edad: /\((.+)\)/.exec(p.nacimiento)?.[1] ?? "",
    peso: p.peso !== SIN_DATOS ? p.peso : "",
    microchip: p.microchip !== SIN_DATOS ? p.microchip : "",
    propietario: p.propietario !== SIN_DATOS ? p.propietario : "",
  };
}

/** Resultado de crearle la cuenta a un dueño: con estos datos el dueño ingresa por primera vez. */
export interface CuentaCreada {
  email: string;
  passwordTemporal: string;
  mascotas: string[];
  mascotaIds: string[];
}

function pesoTexto(kg: number): string {
  return kg % 1 === 0 ? `${Math.trunc(kg)} kg` : `${kg} kg`;
}

const sinVacio = (s: string): string | null => (s.trim() ? s : null);

/** Mascotas que el veterinario en sesión puede ver: las que le compartieron y las que cargó él mismo. */
class PacientesRepoImpl {
  readonly ESPECIE_PERRO = "Perro";
  readonly ESPECIE_GATO = "Gato";
  readonly ESPECIE_OTRO = "Otro";

  private lista: Paciente[] = [];

  get pacientes(): Paciente[] {
    return this.lista;
  }

  limpiar(): void {
    this.lista = [];
  }

  async cargar(): Promise<void> {
    const f = Servicios.fuente;
    const conAcceso = new Set((await f.accesos()).filter((a) => a.estado === "activo").map((a) => a.mascota_id));
    const nuevos = (await f.mascotasDelVeterinario())
      .filter((m) => conAcceso.has(m.id) || m.dueno_id == null)
      .map((m) => this.aPaciente(m));
    this.lista = nuevos;
  }

  private aPaciente(m: MascotaDto): Paciente {
    const dueno = m.dueno;
    let nacimiento: LocalDate | null = null;
    if (m.nacimiento) {
      try {
        nacimiento = LocalDate.parse(m.nacimiento);
      } catch {
        nacimiento = null;
      }
    }
    const edad = nacimiento ? this.edadTexto(nacimiento) : null;
    return {
      id: m.id,
      nombre: m.nombre,
      especie: m.tipo,
      raza: m.raza && m.raza.trim() ? m.raza : m.tipo,
      sexo: m.sexo != null ? m.sexo.charAt(0).toUpperCase() + m.sexo.slice(1) : SIN_DATOS,
      nacimiento: nacimiento ? Fechas.corta(nacimiento) + (edad ? ` (${edad})` : "") : SIN_DATOS,
      fotoPath: m.foto_path ?? null,
      peso: m.peso_kg != null ? pesoTexto(m.peso_kg) : SIN_DATOS,
      microchip: m.microchip ?? SIN_DATOS,
      color: m.color ?? SIN_DATOS,
      observaciones: m.observaciones && m.observaciones.trim() ? m.observaciones : "Sin observaciones",
      propietario: dueno?.nombre ?? m.propietario_nombre ?? SIN_DATOS,
      direccion: dueno?.direccion ?? m.propietario_direccion ?? SIN_DATOS,
      telefono: dueno?.telefono ?? m.propietario_telefono ?? SIN_DATOS,
      email: dueno?.email ?? m.propietario_email ?? SIN_DATOS,
      alertas: m.alertas_clinicas ?? "",
      tieneCuenta: m.dueno_id != null,
      dniPropietario: m.propietario_dni ?? "",
      fotoDueno: dueno?.foto_path ?? null,
      estado: estadoMascotaDeClave(m.estado),
    };
  }

  private edadTexto(nacimiento: LocalDate): string | null {
    const periodo = periodoEntre(nacimiento, LocalDate.now());
    if (periodo.isNegative) return null;
    if (periodo.years >= 1) return periodo.years === 1 ? "1 año" : `${periodo.years} años`;
    return periodo.months <= 1 ? "1 mes" : `${periodo.months} meses`;
  }

  /**
   * Da de alta una mascota cuyo dueño todavía no tiene cuenta (queda a nombre del veterinario hasta que
   * el dueño se registre). Se ve enseguida y se guarda en segundo plano.
   */
  agregarManual(
    nombre: string,
    especie: string,
    raza: string,
    sexo: string,
    propietario: string,
    telefono: string,
    email = "",
    dni = "",
  ): Paciente {
    const paciente: Paciente = {
      id: nuevoId(),
      nombre,
      especie,
      raza: raza.trim() ? raza : especie,
      sexo,
      nacimiento: SIN_DATOS,
      fotoPath: null,
      peso: SIN_DATOS,
      microchip: SIN_DATOS,
      color: SIN_DATOS,
      observaciones: "Sin observaciones",
      propietario,
      direccion: SIN_DATOS,
      telefono: telefono.trim() ? telefono : SIN_DATOS,
      email: email.trim() ? email : SIN_DATOS,
      alertas: "",
      tieneCuenta: false,
      dniPropietario: dni,
      fotoDueno: null,
      estado: "ACTIVA",
    };
    this.lista.push(paciente);
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar();
          Servicios.avisarCambio();
        },
      },
      async () => {
        const sexoMinuscula = sexo.toLowerCase();
        const dto: NuevaMascotaDto = {
          id: paciente.id,
          nombre,
          tipo: especie,
          raza: sinVacio(raza),
          sexo: sexoMinuscula === "macho" || sexoMinuscula === "hembra" ? sexoMinuscula : null,
          propietario_nombre: propietario,
          propietario_dni: sinVacio(dni),
          propietario_telefono: sinVacio(telefono),
          propietario_email: sinVacio(email),
        };
        await Servicios.fuente.crearMascota(dto);
      },
    );
    return paciente;
  }

  /**
   * El veterinario le crea la cuenta al dueño de un paciente: el servidor deja las mascotas a su nombre y el
   * veterinario conserva el acceso. Con [existentes] se vinculan pacientes ya cargados; [nuevas] se crean ahora.
   * Es una operación del servidor, así que no hay copia optimista: se espera la respuesta.
   */
  async crearCuentaDueno(
    nombre: string,
    dni: string,
    telefono: string,
    email: string,
    direccion = "",
    nuevas: MascotaParaCuentaDto[] = [],
    existentes: string[] = [],
  ): Promise<CuentaCreada> {
    const pedido: NuevaCuentaDuenoDto = {
      nombre: nombre.trim(),
      dni: dni.trim(),
      telefono: telefono.trim(),
      email: email.trim().toLowerCase(),
      direccion: sinVacio(direccion.trim()),
      mascotas_nuevas: nuevas,
      mascotas_existentes: existentes,
    };
    const respuesta = await Servicios.fuente.crearCuentaDueno(pedido);
    await this.cargar();
    Servicios.avisarCambio();
    return {
      email: respuesta.email,
      passwordTemporal: respuesta.password_temporal,
      mascotas: respuesta.mascotas.map((m) => m.nombre),
      mascotaIds: respuesta.mascotas.map((m) => m.id),
    };
  }

  /** Pacientes sin cuenta de dueño que comparten propietario con [paciente] (mismo DNI o, si no hay, mismo nombre). */
  mismoPropietarioSinCuenta(paciente: Paciente): Paciente[] {
    return this.lista.filter(
      (otro) =>
        !otro.tieneCuenta &&
        (paciente.dniPropietario.trim()
          ? otro.dniPropietario === paciente.dniPropietario
          : otro.propietario.toLowerCase() === paciente.propietario.toLowerCase()),
    );
  }

  porId(id: string | null | undefined): Paciente | null {
    return this.lista.find((p) => p.id === id) ?? null;
  }

  /** El peso medido en una consulta pasa a ser el del paciente; el servidor hace lo mismo al guardar el informe. */
  actualizarPeso(id: string, kg: number): void {
    const i = this.lista.findIndex((p) => p.id === id);
    if (i < 0) return;
    this.lista[i] = { ...this.lista[i], peso: pesoTexto(kg) };
  }

  /** Cambia las alertas clínicas del paciente; se ven ya y se guardan en segundo plano. */
  guardarAlertas(id: string, alertas: string): void {
    const i = this.lista.findIndex((p) => p.id === id);
    if (i < 0) return;
    this.lista[i] = { ...this.lista[i], alertas: alertas.trim() };
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar();
          Servicios.avisarCambio();
        },
      },
      async () => {
        await Servicios.fuente.guardarAlertas(id, alertas.trim());
      },
    );
  }

  /** Foto de perfil del dueño de ese paciente, si tiene cuenta y subió una. */
  fotoDuenoDe(id: string | null | undefined): string | null {
    return this.porId(id)?.fotoDueno ?? null;
  }

  /** Nombre del paciente para mostrar en listas aunque ya no esté disponible. */
  nombreDe(id: string | null | undefined): string {
    return this.porId(id)?.nombre ?? "Mascota";
  }

  filtrar(consulta: string, especie: string | null): Paciente[] {
    const q = consulta.trim().toLowerCase();
    return this.pacientes.filter((p) => {
      const coincideEspecie =
        especie === null ? true : especie === this.ESPECIE_OTRO ? !TiposMascota.esConocido(p.especie) : p.especie === especie;
      return (
        coincideEspecie &&
        (q === "" ||
          p.nombre.toLowerCase().includes(q) ||
          p.raza.toLowerCase().includes(q) ||
          p.propietario.toLowerCase().includes(q))
      );
    });
  }
}

export const PacientesRepo = new PacientesRepoImpl();
