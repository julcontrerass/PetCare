# Actualización de Foto y Datos de Mascota

He añadido la funcionalidad para cambiar la foto de la mascota y he mejorado los diálogos de edición.

## Cambios Realizados

### Cambio de Foto ([InformacionFragment.kt](file:///C:/Users/juani/eclipse-workspace/PetCare/app/src/main/java/frgp/utn/edu/petcare/InformacionFragment.kt))
- **Selector de Imágenes**: Implementé el uso de `ActivityResultContracts.GetContent()`, que es la forma moderna de abrir la galería del celular.
- **Interacción**: Al tocar el **icono de la cámara** sobre la foto de la mascota, se abre automáticamente la galería para elegir una nueva imagen.
- **Actualización Visual**: La nueva foto se aplica instantáneamente al círculo de perfil de la mascota.

### Mejoras en Edición
- **Persistencia de Texto**: Corregí un pequeño error en la asignación de textos al guardar los cambios en los diálogos, asegurando que el contenido se actualice correctamente como `String`.

## Verificación
1. Ve a la pestaña **Información**.
2. Toca el **icono pequeño de la cámara** (círculo blanco con cámara negra) sobre la foto de Koda.
3. Elige una foto de tu galería. Verás cómo cambia la imagen circular.
4. Toca el **lápiz** o el botón **"Editar información"** para verificar que los textos siguen siendo editables.

> [!TIP]
> La aplicación solicitará permiso para acceder a tus archivos multimedia la primera vez que intentes cambiar la foto, lo cual es el comportamiento estándar de Android para proteger tu privacidad.
