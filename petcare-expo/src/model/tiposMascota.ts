/** "Hurón" y "huron" se comparan igual. */
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Los tipos de animal que se pueden cargar; es la lista única de la app del dueño y del veterinario. */
export const TiposMascota = {
  PERRO: "Perro",
  GATO: "Gato",
  AVE: "Ave",
  REPTIL: "Reptil",
  PEZ: "Pez",
  ROEDOR: "Roedor",
  CONEJO: "Conejo",
  HURON: "Hurón",
  CABALLO: "Caballo",
  CERDO: "Cerdo",
  OTRO: "Otro",

  /**
   * Los tipos con nombre propio, en el orden en que se muestran. Tiene que coincidir con la lista de la base
   * (restricción de veterinarios.tipos_animales y private.validar_turno).
   */
  PRINCIPALES: ["Perro", "Gato", "Ave", "Reptil", "Pez", "Roedor", "Conejo", "Hurón", "Caballo", "Cerdo"] as string[],

  /** Todos los tipos que se pueden elegir; "Otro" sirve para cualquier animal que no esté en la lista. */
  TODOS: ["Perro", "Gato", "Ave", "Reptil", "Pez", "Roedor", "Conejo", "Hurón", "Caballo", "Cerdo", "Otro"] as string[],

  /** "Perro" pasa a "Perros", "Pez" a "Peces", y así. */
  plural(tipo: string): string {
    switch (tipo) {
      case "Perro": return "Perros";
      case "Gato": return "Gatos";
      case "Ave": return "Aves";
      case "Reptil": return "Reptiles";
      case "Pez": return "Peces";
      case "Roedor": return "Roedores";
      case "Conejo": return "Conejos";
      case "Hurón": return "Hurones";
      case "Caballo": return "Caballos";
      case "Cerdo": return "Cerdos";
      default: return "Otros";
    }
  },

  /** El tipo tal como se compara con lo que atiende un veterinario: lo que no tiene nombre propio es "Otro". */
  normalizar(tipo: string | null | undefined): string {
    const buscado = sinTildes(tipo?.trim() ?? "");
    return TiposMascota.PRINCIPALES.find((p) => sinTildes(p) === buscado) ?? "Otro";
  },

  /** True si el tipo tiene nombre propio; si no, se cuenta como "Otro". */
  esConocido(tipo: string): boolean {
    return TiposMascota.PRINCIPALES.some((p) => sinTildes(p) === sinTildes(tipo));
  },

  /** Nombre del ícono (de MaterialCommunityIcons) que representa al animal. */
  icono(tipo: string | null | undefined): string {
    switch (tipo) {
      case "Perro": return "dog";
      case "Gato": return "cat";
      case "Ave": return "bird";
      case "Reptil": return "snake";
      case "Pez": return "fish";
      case "Roedor": return "rodent";
      case "Conejo": return "rabbit";
      case "Caballo": return "horse";
      case "Cerdo": return "pig";
      default: return "paw";
    }
  },
};
