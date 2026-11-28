/** Un servicio o especialidad del catálogo (tabla catalogo_servicios). */
export interface ItemCatalogo {
  nombre: string;
  tipo: "servicio" | "especialidad";
  duracion_min: number;
  activo: boolean;
  orden?: number;
}

/**
 * Servicios y especialidades médicas que ofrece la clínica. Es la lista única que usan el registro del
 * veterinario, su perfil y el filtro del dueño al sacar un turno. La maneja el administrador: al arrancar se baja de
 * la base con [aplicar]; hasta entonces (o sin conexión) vale la lista de siempre de acá abajo.
 */
export const CatalogoMedico = {
  /** Los que el administrador desactivó: no se eligen ni se ofrecen (en minúsculas). */
  INACTIVOS: new Set<string>(),

  /** Todo el catálogo, con los desactivados, para la pantalla del administrador. */
  ITEMS: [] as ItemCatalogo[],

  SERVICIOS: [
    "Chequeo médico integral",
    "Castraciones y limpieza dental",
    "Cirugía 24hs",
    "Laboratorio y diagnóstico por imágenes",
    "Tomografía",
    "Baño y peluquería",
  ],

  ESPECIALIDADES: [
    "Oncología",
    "Cardiología",
    "Fisioterapia",
    "Gastroenterología",
    "Nutrición",
    "Dermatología",
    "Exóticos",
    "Oftalmología",
    "Nefrourología",
    "Endocrinología",
    "Neurología",
    "Homeopatía",
    "Medicina felina",
    "Hematología",
    "Parasitología",
    "Neumonología",
    "Medicina del dolor",
  ],

  /** Servicios primero y después las especialidades, en el orden en que se muestran. */
  get TODAS(): string[] {
    return [...this.SERVICIOS, ...this.ESPECIALIDADES];
  },

  /** Reemplaza la lista con la de la base (los arreglos se cambian en el lugar: los que los guardan ven lo nuevo). */
  aplicar(items: readonly ItemCatalogo[]): void {
    if (items.length === 0) return;
    const orden = [...items].sort((a, b) => (a.orden ?? 1000) - (b.orden ?? 1000) || a.nombre.localeCompare(b.nombre));
    const activos = (tipo: ItemCatalogo["tipo"]) => orden.filter((i) => i.tipo === tipo && i.activo).map((i) => i.nombre);
    this.SERVICIOS.splice(0, this.SERVICIOS.length, ...activos("servicio"));
    this.ESPECIALIDADES.splice(0, this.ESPECIALIDADES.length, ...activos("especialidad"));
    // Las desactivadas siguen pidiendo título: un veterinario que la tenía no la ofrece sin aprobación
    this.TODAS_LAS_ESPECIALIDADES = orden.filter((i) => i.tipo === "especialidad").map((i) => i.nombre);
    this.INACTIVOS = new Set(orden.filter((i) => !i.activo).map((i) => i.nombre.toLowerCase()));
    for (const i of orden) this.DURACIONES_POR_DEFECTO[i.nombre] = i.duracion_min;
    this.ITEMS = orden;
  },

  /** Todas las especialidades, también las desactivadas (para saber cuáles piden título). */
  TODAS_LAS_ESPECIALIDADES: [] as string[],

  /** Es un servicio o una especialidad del catálogo (no un tipo general como "Consulta"). */
  esDelCatalogo(nombre: string): boolean {
    const n = nombre.trim().toLowerCase();
    return this.TODAS.some((t) => t.toLowerCase() === n) || this.ITEMS.some((i) => i.nombre.toLowerCase() === n);
  },

  activo(nombre: string): boolean {
    return !this.INACTIVOS.has(nombre.toLowerCase());
  },

  esServicio(nombre: string): boolean {
    return this.SERVICIOS.some((s) => s.toLowerCase() === nombre.toLowerCase());
  },

  /** Las especialidades piden título aprobado para ofrecerse; los servicios, no. */
  pideTitulo(nombre: string): boolean {
    const n = nombre.toLowerCase();
    return this.ESPECIALIDADES.some((s) => s.toLowerCase() === n) || this.TODAS_LAS_ESPECIALIDADES.some((s) => s.toLowerCase() === n);
  },

  /** Tipos generales para cargar cualquier atención, además de los servicios del veterinario. */
  TIPOS_GENERALES: ["Consulta", "Control", "Vacuna", "Desparasitación", "Tratamiento", "Cirugía", "Otro"],

  /**
   * Tipos de evento para elegir: los servicios que ofrece el veterinario y los generales, sin repetir. Un tipo general
   * que ya está cubierto por un servicio no se muestra aparte (con "Cirugía 24hs" no aparece también "Cirugía").
   * [actual] es el tipo de un turno que se está editando: siempre está.
   */
  tiposDeEvento(ofrecidos: readonly string[], actual: string | null = null): string[] {
    const normal = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
    const cubierto = (g: string) => ofrecidos.some((o) => normal(o) !== normal(g) && normal(o).startsWith(`${normal(g)} `));
    const generales = this.TIPOS_GENERALES.filter((g) => !cubierto(g));
    const extra = actual && actual.trim() ? [actual] : [];
    return [...new Set([...ofrecidos, ...generales, ...extra])];
  },

  /**
   * Lo que el veterinario ofrece a los dueños: sus servicios y las especialidades con el título aprobado, sin las que
   * el administrador desactivó.
   */
  ofrecidas(elegidas: readonly string[], aprobadas: readonly string[] | null | undefined): string[] {
    const ok = new Set((aprobadas ?? []).map((a) => a.toLowerCase()));
    return elegidas.filter((e) => this.activo(e) && (!this.pideTitulo(e) || ok.has(e.toLowerCase())));
  },

  /** Vacunas que más se aplican, para sugerirlas al cargar una (se puede escribir cualquier otra). */
  vacunasHabituales(tipoMascota: string | null | undefined): string[] {
    switch (tipoMascota?.trim().toLowerCase()) {
      case "perro":
        return ["Antirrábica", "Quíntuple (DHPPi + L)", "Séxtuple", "Triple canina", "Tos de las perreras", "Giardia", "Leishmaniasis"];
      case "gato":
        return ["Antirrábica", "Triple felina", "Cuádruple felina", "Leucemia felina"];
      case "roedor":
        return ["Antirrábica"];
      default:
        return [];
    }
  },

  DURACION_GENERAL_MIN: 30,
  DURACION_MINIMA_MIN: 15,
  DURACION_MAXIMA_MIN: 480,
  PASO_DURACION_MIN: 15,

  /**
   * Minutos que dura cada servicio o especialidad si el veterinario no configuró otra cosa. Tiene que
   * coincidir con `private.duracion_por_defecto` de la base, que es la que fija la duración real del turno.
   */
  DURACIONES_POR_DEFECTO: {
    "Chequeo médico integral": 30,
    "Castraciones y limpieza dental": 90,
    "Cirugía 24hs": 120,
    "Laboratorio y diagnóstico por imágenes": 45,
    "Tomografía": 60,
    "Baño y peluquería": 60,
    "Oncología": 60,
    "Cardiología": 45,
    "Fisioterapia": 45,
    "Gastroenterología": 45,
    "Nutrición": 30,
    "Dermatología": 30,
    "Exóticos": 45,
    "Oftalmología": 30,
    "Nefrourología": 45,
    "Endocrinología": 30,
    "Neurología": 60,
    "Homeopatía": 45,
    "Medicina felina": 30,
    "Hematología": 30,
    "Parasitología": 30,
    "Neumonología": 45,
    "Medicina del dolor": 45,
  } as Record<string, number>,

  duracionPorDefecto(nombre: string | null | undefined): number {
    const buscado = nombre?.trim().toLowerCase();
    const par = Object.entries(this.DURACIONES_POR_DEFECTO).find(([k]) => k.toLowerCase() === buscado);
    return par ? par[1] : this.DURACION_GENERAL_MIN;
  },

  /** "30 min", "1 h", "1 h 30 min". */
  textoDuracion(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas === 0) return `${resto} min`;
    if (resto === 0) return `${horas} h`;
    return `${horas} h ${resto} min`;
  },
};
