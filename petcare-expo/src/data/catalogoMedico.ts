/**
 * Servicios y especialidades médicas que ofrece la clínica. Es la lista única que usan el registro del
 * veterinario, su perfil y el filtro del dueño al sacar un turno.
 */
export const CatalogoMedico = {
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

  esServicio(nombre: string): boolean {
    return this.SERVICIOS.some((s) => s.toLowerCase() === nombre.toLowerCase());
  },

  /** Las especialidades piden título aprobado para ofrecerse; los servicios, no. */
  pideTitulo(nombre: string): boolean {
    return this.ESPECIALIDADES.some((s) => s.toLowerCase() === nombre.toLowerCase());
  },

  /** Lo que el veterinario ofrece a los dueños: sus servicios y las especialidades con el título aprobado. */
  ofrecidas(elegidas: readonly string[], aprobadas: readonly string[] | null | undefined): string[] {
    const ok = new Set((aprobadas ?? []).map((a) => a.toLowerCase()));
    return elegidas.filter((e) => !this.pideTitulo(e) || ok.has(e.toLowerCase()));
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
