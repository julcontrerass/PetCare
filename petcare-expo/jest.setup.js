// Las pruebas usan una fuente de datos en memoria; esto solo silencia avisos de módulos nativos.
jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK: 1,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

// Íconos: no hace falta cargar las fuentes en las pruebas
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icono = ({ name }) => React.createElement(Text, null, `icono:${name}`);
  return new Proxy({ __esModule: true }, { get: (destino, clave) => (clave in destino ? destino[clave] : Icono) });
});

// Navegación: `router` es un objeto único con funciones simuladas; los parámetros de la ruta se fijan con
// `globalThis.__parametrosDeRuta = { id: "123" }` (ver __tests__/soporte/rutas.ts)
jest.mock("expo-router", () => {
  const React = require("react");
  const router = {
    push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismiss: jest.fn(),
    canGoBack: jest.fn(() => true), setParams: jest.fn(),
  };
  const contenedor = ({ children }) => children ?? null;
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: () => globalThis.__parametrosDeRuta ?? {},
    useGlobalSearchParams: () => globalThis.__parametrosDeRuta ?? {},
    usePathname: () => "/",
    useSegments: () => [],
    useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn() }),
    useFocusEffect: (efecto) => React.useEffect(efecto, []),
    Redirect: () => null,
    Link: contenedor,
    Slot: () => null,
    Stack: Object.assign(contenedor, { Screen: () => null }),
    Tabs: Object.assign(contenedor, { Screen: () => null }),
  };
});

// Almacenamiento en memoria para las pruebas
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
