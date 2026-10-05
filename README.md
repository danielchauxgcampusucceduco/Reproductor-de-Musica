# Taller Reproductor de Música

Aplicación web educativa construida con Vite, TypeScript estricto, HTML y CSS. Organiza la playlist con una lista doblemente enlazada y reproduce archivos de audio reales seleccionados desde una carpeta del dispositivo. La lógica de la lista y del reproductor está separada de la interfaz mediante suscripciones a cambios de estado.

## Instalación y ejecución

Requiere Node.js y npm.

```bash
npm install
npm run dev
```

Para generar la versión de producción y servirla localmente:

```bash
npm run build
npm run preview
```

Ejecuta las pruebas automáticas con `npm test`.

## Estructura del proyecto

```text
src/
  core/       Nodo y lista doblemente enlazada genérica
  domain/     Canción, motor de audio intercambiable y controlador
  services/  Lectura y escritura del estado en localStorage
  ui/         Coordinación del renderizado y eventos
    components/ Filas, formulario, avisos, iconos y visualizador
  styles/     Tokens, componentes y animaciones
  main.ts     Punto de entrada y conexión de las capas
tests/        Pruebas de la lista y del controlador
```

## Lista doblemente enlazada

Cada canción se guarda en un nodo con referencias reales a su vecino anterior (`prev`) y siguiente (`next`). La lista conserva `head`, `tail` y `size`; recorrer desde el índice medio comienza en el extremo más cercano. La interfaz y la persistencia reciben una vista serializable mediante `toArray()`; el almacenamiento de la playlist sigue siendo la cadena de nodos.

```text
HEAD                                             TAIL
  ↓                                                ↓
null ← [prev | Canción A | next] ⇄ [prev | Canción B | next] ⇄ [prev | Canción C | next] → null
          actual: Canción B
```

| Operación | Complejidad | Nota |
|---|---:|---|
| `addFirst`, `addLast` | O(1) | Enlace directo al extremo |
| `addAt` | O(n) | Busca desde el extremo más cercano |
| `removeFirst`, `removeLast` | O(1) | Actualiza cabeza o cola |
| `removeAt`, `getNodeAt` | O(n) | Recorrido desde el extremo más cercano |
| `removeNode` | O(1) | Comprueba propiedad del nodo y reconecta vecinos |
| `findNode`, `indexOf` | O(n) | Búsqueda secuencial |
| `moveNode` | O(n) | Busca posiciones y reutiliza el nodo original |
| `clear`, `toArray` | O(n) | Desconecta nodos o crea la vista serializable |
| `isEmpty` | O(1) | Consulta el tamaño |

## Funcionalidades

- Agregar canciones al inicio, al final o en cualquier posición válida, con validación y vista previa del lugar de inserción.
- Cargar una carpeta local de música. Se leen título del archivo, carpeta contenedora y duración; el navegador reproduce los archivos compatibles mediante HTML Audio.
- Play/pausa, progreso sincronizado con el audio real, volumen, siguiente, anterior y selección directa. Las canciones creadas manualmente conservan el modo de reproducción simulado.
- Repetición desactivada, de toda la lista o de una canción; reproducción aleatoria sin repetir antes de agotar las canciones e historial para volver a la anterior.
- Eliminar cualquier canción y deshacer la última eliminación desde el aviso temporal.
- Marcar favoritas, buscar por título o artista, filtrar favoritas, ver el número de canciones y su duración total.
- Reordenar con controles accesibles o arrastrar y soltar; el visualizador presenta `HEAD`, `TAIL`, `ACTUAL`, `null` y los enlaces por nodo.
- Guardado local de canciones ingresadas manualmente, favoritas y selección actual. Los archivos del dispositivo no se copian ni se guardan en el navegador: vuelve a elegir la carpeta después de recargar.
- Tema oscuro/claro, diseño adaptable, controles con nombres accesibles y respeto por `prefers-reduced-motion`.

## Funciones diferenciadoras

- Visualizador vivo de `HEAD`, `TAIL`, `ACTUAL`, `null` y enlaces `prev`/`next` para explicar la lista doble mientras se usa.
- Modo aleatorio sin repetir canciones hasta recorrer la lista, con historial para volver atrás.
- Deshacer eliminaciones, reordenamiento por arrastre y controles accesibles para mover canciones sin ratón.
- Carátulas SVG distintas por canción y artista, con disco, órbitas y barras de onda que se animan durante la reproducción; miniaturas sincronizadas en cada fila.
- Búsqueda instantánea, filtro de favoritas, contador y duración total.
- Reproducción local real desde una carpeta, sin subir canciones a un servidor ni incluir música de muestra codificada en el proyecto.

La reproducción depende de los formatos que el navegador y el sistema puedan decodificar. Al importar una carpeta se leen metadatos de audio; los archivos no compatibles se omiten. El navegador solo entrega acceso a los archivos elegidos en esa sesión, por lo que se debe volver a seleccionar la carpeta después de recargar.

## Atajos de teclado

| Tecla | Acción |
|---|---|
| Espacio | Reproducir o pausar |
| ← | Canción anterior; si han pasado más de 3 segundos, reinicia la actual |
| → | Canción siguiente |
| Supr | Eliminar la canción seleccionada; el aviso permite deshacer |

Los atajos globales se suspenden mientras el foco está en un control del formulario o en un botón.

## Capturas sugeridas para la entrega

1. Escritorio con el reproductor, controles, formulario y visualizador visibles.
2. Búsqueda filtrando canciones y el nodo `ACTUAL` resaltado.
3. Vista móvil con la lista y los controles de reordenamiento.

## Verificación de entrega

- [x] Agregar al inicio, al final y en cualquier posición válida, con vista previa.
- [x] Eliminar también la canción actual y restaurarla con Deshacer.
- [x] Avanzar y retroceder en los extremos y en medio; respetar repetición y aleatorio.
- [x] Mantener la playlist en nodos con enlaces `prev` y `next`; no usar arreglos como almacenamiento interno.
- [x] Actualizar el visualizador tras insertar, borrar, seleccionar o reordenar.
- [x] Adaptar la interfaz a escritorio y móvil, con nombres accesibles y controles por teclado.
- [x] Mantener nombres técnicos en inglés y textos, comentarios y documentación en español.
- [x] Abrir con playlist vacía; no incluir canciones de demostración codificadas.
- [x] Elegir una carpeta de música y reproducir sus archivos compatibles localmente.
- [x] Compilar y ejecutar las pruebas automatizadas antes de entregar.
