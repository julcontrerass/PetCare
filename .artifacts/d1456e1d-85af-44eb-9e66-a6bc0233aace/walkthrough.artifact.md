# Navegación Fluida con ViewPager2

He refactorizado la aplicación para utilizar `ViewPager2`, lo que permite un deslizamiento lateral (swipe) limpio y fluido entre las secciones de la mascota sin necesidad de recargar la pantalla completa.

## Cambios Realizados

### Refactorización a Fragmentos
He dividido el contenido en tres fragmentos independientes, lo que permite que el Toolbar y el TabLayout permanezcan fijos mientras el contenido se desliza:
- **[InformacionFragment.kt](file:///C:/Users/juani/eclipse-workspace/PetCare/app/src/main/java/frgp/utn/edu/petcare/InformacionFragment.kt)**: Contiene la foto y detalles básicos de Koda.
- **[HistorialFragment.kt](file:///C:/Users/juani/eclipse-workspace/PetCare/app/src/main/java/frgp/utn/edu/petcare/HistorialFragment.kt)**: Gestiona la lista del historial clínico.
- **[RecordatoriosFragment.kt](file:///C:/Users/juani/eclipse-workspace/PetCare/app/src/main/java/frgp/utn/edu/petcare/RecordatoriosFragment.kt)**: Gestiona la lista de recordatorios.

### Implementación de ViewPager2
- **[DetalleDeMascotaActivity.kt](file:///C:/Users/juani/eclipse-workspace/PetCare/app/src/main/java/frgp/utn/edu/petcare/DetalleDeMascotaActivity.kt)**: Ahora actúa como el contenedor principal. Utiliza un `FragmentStateAdapter` para manejar los fragmentos.
- **TabLayoutMediator**: Vincula el `TabLayout` con el `ViewPager2`. Al tocar una pestaña, el contenido se desliza suavemente hacia ella, y viceversa.

### Mejoras Visuales ([detalle_de_mascota.xml](file:///C:/Users/juani/eclipse-workspace/PetCare/app/src/main/res/layout/detalle_de_mascota.xml))
- Se añadió la barra de navegación inferior (`BottomNavigationView`) de forma persistente.
- Se eliminaron los parpadeos y recargas bruscas al cambiar de sección.

> [!IMPORTANT]
> Esta arquitectura es la recomendada por Google para este tipo de interfaces. Ahora puedes tanto **tocar las pestañas** como **deslizar el dedo lateralmente** sobre el contenido para navegar.

## Verificación
1. Ejecuta la app en tu celular.
2. Desliza el dedo de derecha a izquierda sobre la información de Koda. Verás cómo aparece el Historial con un movimiento suave.
3. El indicador teal debajo de las pestañas se moverá sincronizadamente con tu dedo.
