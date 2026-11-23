# PetCare (Expo / React Native)

Migración completa de la app Android de PetCare (Kotlin) a **React Native con Expo**, con la misma funcionalidad, los
mismos textos y el mismo backend (Supabase). Funciona en **Android, iOS y la web** desde una sola base de código.
La app Android original sigue en `../app/` como referencia. Cómo se tradujo cada parte: [`MIGRACION.md`](MIGRACION.md) y
[`GUIA_PANTALLAS.md`](GUIA_PANTALLAS.md).

## Requisitos
Node 20 o más nuevo. No hace falta instalar nada más: Expo trae su propia herramienta.

```bash
cd petcare-expo
npm install
npx expo start            # menú: a = Android, w = web; o escaneá el QR con Expo Go
npx expo start --web      # solo la web
```

## Configuración
Las claves públicas de Supabase ya vienen por defecto (la seguridad la da RLS en la base). Para usar otro proyecto
copiá `.env.example` a `.env` y cambiá `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY`.

En el panel de Supabase, en **Authentication > URL Configuration > Redirect URLs**, agregá:
- `petcare://recuperar` (recuperar contraseña desde la app);
- `https://TU-DOMINIO/auth/recuperar` (recuperar contraseña desde la web).

Las funciones de servidor (`crear-cuenta-dueno`, `avisar-veterinario`) son las mismas que usaba la versión Android.

## Verificación
```bash
npm run typecheck                    # tipos (tsc)
npm test                             # pruebas (jest)
npx expo lint                        # estilo
npx expo export --platform web       # sitio web estático en dist/
npx expo export --platform android   # bundle de Android
```

## Publicar
- **Web**: `npx expo export --platform web` genera `dist/`, una página única (SPA): se sirve en cualquier hosting
  estático con "todas las rutas a index.html" (Netlify, Vercel, Firebase Hosting, GitHub Pages con 404.html).
- **Android/iOS**: `npx eas build` (hace falta una cuenta de Expo).

## Estructura
```
src/app/        rutas (expo-router): auth/, dueno/, vet/, admin/
src/ui/         pantallas por rol y el kit de componentes (src/ui/common, ver INDICE.md)
src/data/       repositorios, sesión, avisos y la capa remota (Supabase)
src/model/      modelos de dominio
src/util/       fechas (LocalDate...), errores, ids
__tests__/      pruebas de jest (datos, pantallas y componentes)
```

## Lo que no se puede probar en este tipo de entorno
Las notificaciones programadas con la app cerrada y las funciones del teléfono (cámara, archivos, compartir) se
ejecutan en un dispositivo real; en la web las notificaciones solo se ven con la pestaña abierta.
