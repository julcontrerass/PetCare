const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expo,
  { ignores: ["dist/*", ".expo/*", "node_modules/*"] },
  {
    rules: {
      // Reglas del compilador de React: la app no lo usa y su diseño copia el de la versión Android (los repositorios
      // son objetos mutables en memoria que las pantallas leen en cada render, y las animaciones usan el
      // `useRef(new Animated.Value()).current` habitual de React Native), así que no aplican.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // No reconoce los exports de expo-notifications
      "import/namespace": "off",
    },
  },
  {
    // En las pruebas `jest.mock` va antes de los imports y se repite el módulo en simulaciones
    files: ["__tests__/**"],
    rules: { "import/first": "off", "import/no-duplicates": "off" },
  },
]);
