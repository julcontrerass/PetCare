/** Paleta de PetCare (los mismos valores que tenía la app Android en colors.xml). */
export const Colores = {
  black: "#000000",
  white: "#FFFFFF",
  primaryTeal: "#02797A",
  brandNavy: "#0B2A4A",
  lightGray: "#F5F5F5",
  textGray: "#808080",
  lightTeal: "#E0F2F2",
  accentOrange: "#F5A623",
  lightOrange: "#FFF3E0",
  accentOrangeDark: "#C77700",
  successGreen: "#1B8A5A",
  lightGreen: "#E1F5EA",
  dangerRed: "#E5484D",
  lightRed: "#FDE8E8",
  accentPurple: "#8B5CF6",
  lightPurple: "#F1E9FE",

  iconBlueBg: "#E3F2FD",
  iconGreenBg: "#E8F5E9",
  iconOrangeBg: "#FFF3E0",
  iconPurpleBg: "#F3E5F5",
  iconPinkBg: "#FCE4EC",
  iconTealBg: "#E0F2F2",

  dividerColor: "#CCCCCC",
  dividerLight: "#F0F0F0",
  tealDark: "#0B4F4C",
  loginBg: "#F7F6F1",
  loginFieldStroke: "#E1E6E4",
  textAviso: "#3F5266",
  lightTealSoft: "#EEF8F8",
} as const;

export type NombreColor = keyof typeof Colores;
