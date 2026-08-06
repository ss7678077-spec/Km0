# KM0 — buscador de autos multi-sitio

## Qué hay construido ahora mismo

- `index.html` / `style.css` / `script.js` — la página completa: formulario de búsqueda, resumen de mercado y grilla de resultados. Funciona 100%, pero con datos de ejemplo.
- `netlify/functions/search-cars.js` — el "backend": recibe marca/modelo/año y hoy regresa 3 anuncios de ejemplo (2 de Mercado Libre, 1 de Seminuevos) en vez de datos reales.
- El cálculo de promedio de mercado, el % de diferencia por anuncio, y el estimado de reventa **sí son reales** — corren sobre los datos de ejemplo tal como correrían sobre datos reales.

## Cómo probarlo en tu computadora

1. Instala [Node.js](https://nodejs.org) si no lo tienes.
2. Instala la CLI de Netlify una sola vez: `npm install -g netlify-cli`
3. Dentro de la carpeta del proyecto: `netlify dev`
4. Abre la URL que te muestre en consola (normalmente `http://localhost:8888`).
5. Busca cualquier marca/modelo/año — vas a ver las 3 tarjetas de ejemplo, ordenadas por distancia, con su badge de "% vs. promedio" en ámbar (debajo del promedio) o terracota (arriba del promedio).

Si abres `index.html` directo con doble clic (sin `netlify dev`), el formulario va a fallar al buscar, porque `/.netlify/functions/search-cars` solo existe cuando Netlify está corriendo el proyecto.

## Publicarlo (como hiciste con Everventas)

1. Sube esta carpeta a un repositorio de GitHub.
2. En Netlify: "Add new site" → "Import an existing project" → conecta el repo.
3. Netlify detecta `netlify.toml` solo — no necesitas configurar nada más.
4. Cuando quieras conectar la base de datos de Supabase (para guardar búsquedas o cachear resultados), las variables de entorno se agregan en Netlify → Site settings → Environment variables, igual que en Everventas.

## Lo que falta (Fase 2): scraping real

Ahora mismo `buscarEnMercadoLibre()` y `buscarEnSeminuevos()` en `search-cars.js` regresan datos inventados. Para que jalen datos reales, cada una necesita:

1. Pedir el HTML de la página de resultados de esa fuente con la marca/modelo/año.
2. Usar una librería para "leer" ese HTML y sacar título, precio, foto y link de cada anuncio (la más común para esto en Node es `cheerio`).
3. Acomodar esos datos en el mismo formato `{ titulo, precio, foto, fuente, distanciaKm }` que ya usa el resto del código, para no tener que tocar `script.js`.

Esta parte conviene hacerla viendo el HTML real de cada sitio (los nombres de clases CSS cambian entre sitios y con el tiempo), así que es mejor hacerla juntos cuando quieras avanzar a esa fase — te puedo ir guiando selector por selector.

Nota: revisa los términos de servicio de cada sitio antes de hacer scraping en producción con tráfico real; para aprendizaje y uso personal el riesgo es bajo, pero es bueno saberlo de antemano.

## Facebook Marketplace

Se deja pendiente a propósito. No tiene API pública ni una estructura de HTML estable para leer, y su scraping suele requerir simular un navegador logueado (herramientas como Playwright), lo cual es un salto de complejidad grande. Cuando el resto del proyecto esté sólido, es el mejor siguiente paso.
