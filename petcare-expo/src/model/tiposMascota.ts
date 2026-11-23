/** Los tipos de animal que se pueden cargar; es la lista única de la app del dueño y del veterinario. */
export const TiposMascota = {
  PERRO: "Perro",
  GATO: "Gato",
  AVE: "Ave",
  REPTIL: "Reptil",
  PEZ: "Pez",
  ROEDOR: "Roedor",
  OTRO: "Otro",

  /** Los tipos con nombre propio, en el orden en que se muestran. */
  PRINCIPALES: ["Perro", "Gato", "Ave", "Reptil", "Pez", "Roedor"] as string[],

  /** Todos los tipos que se pueden elegir; "Otro" sirve para cualquier animal que no esté en la lista. */
  TODOS: ["Perro", "Gato", "Ave", "Reptil", "Pez", "Roedor", "Otro"] as string[],

  /** "Perro" pasa a "Perros", "Pez" a "Peces", y así. */
  plural(tipo: string): string {
    switch (tipo) {
      case "Perro": return "Perros";
      case "Gato": return "Gatos";
      case "Ave": return "Aves";
      case "Reptil": return "Reptiles";
      case "Pez": return "Peces";
      case "Roedor": return "Roedores";
      default: return "Otros";
    }
  },

  /** El tipo tal como se compara con lo que atiende un veterinario: lo que no tiene nombre propio es "Otro". */
  normalizar(tipo: string | null | undefined): string {
    const buscado = tipo?.trim().toLowerCase();
    return TiposMascota.PRINCIPALES.find((p) => p.toLowerCase() === buscado) ?? "Otro";
  },

  /** True si el tipo tiene nombre propio; si no, se cuenta como "Otro". */
  esConocido(tipo: string): boolean {
    return TiposMascota.PRINCIPALES.some((p) => p.toLowerCase() === tipo.toLowerCase());
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
      default: return "paw";
    }
  },
};
