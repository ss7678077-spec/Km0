// ============================================================
// netlify/functions/search-cars.js
//
// Por qué existe este archivo (y no llamamos todo desde script.js):
// El navegador no puede pedirle datos directamente a Seminuevos.com
// ni a Mercado Libre por una restricción de seguridad llamada CORS,
// y además Seminuevos no tiene API, así que hay que leer su HTML.
// Ese trabajo de "leer HTML" tiene que pasar por un servidor, no por
// el navegador del usuario. Netlify Functions es justo eso: un
// mini-servidor que se despierta solo cuando alguien lo llama, sin
// que tengas que rentar ni administrar un servidor tú mismo.
//
// Flujo de datos completo:
//   navegador (script.js)
//     -> GET /.netlify/functions/search-cars?marca=...&modelo=...&anio=...
//     -> esta función pide los datos a cada fuente
//     -> junta todo en un solo formato
//     -> regresa JSON al navegador
//
// ESTADO ACTUAL: esta función regresa datos de ejemplo (mock), no
// datos reales todavía. Es el punto de partida correcto porque te
// permite construir y probar todo el frontend (formulario, tarjetas,
// cálculo de promedio) sin depender de que el scraping ya funcione.
// Cuando quieras, seguimos con la Fase 2: reemplazar
// buscarEnSeminuevos() por un scraper real usando una librería como
// cheerio, y buscarEnMercadoLibre() por una llamada autenticada con
// OAuth (ver la nota sobre la API de Mercado Libre más abajo).
// ============================================================

const cheerio = require('cheerio');

exports.handler = async (event) => {
  const { marca = '', modelo = '', anio = '' } = event.queryStringParameters || {};

  if (!marca || !modelo) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Faltan marca y/o modelo' }),
    };
  }

  try {
    // Se piden las dos fuentes al mismo tiempo (Promise.all) en vez
    // de una después de la otra, para que la búsqueda no tarde el
    // doble de lo necesario.
    const [meliResults, seminuevosResults] = await Promise.all([
      buscarEnMercadoLibre({ marca, modelo, anio }),
      buscarEnSeminuevos({ marca, modelo, anio }),
    ]);

    const listings = [...meliResults, ...seminuevosResults];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error buscando anuncios' }),
    };
  }
};

// ------------------------------------------------------------
// FUENTE 1: Mercado Libre
// ------------------------------------------------------------
// NOTA IMPORTANTE: desde abril de 2025, Mercado Libre exige que las
// búsquedas generales (/sites/MLM/search) vengan con un token de una
// cuenta autenticada, y aun así solo devuelve resultados ligados a
// esa cuenta — no una búsqueda abierta de todo el marketplace. Por
// eso esta fuente, en la práctica, también requiere leer el HTML de
// la página de resultados en vez de usar la API, igual que
// Seminuevos. La dejamos como función separada para que el resto del
// código no cambie el día que ajustes cómo obtiene los datos.
async function buscarEnMercadoLibre({ marca, modelo, anio }) {
  // TODO Fase 2: reemplazar por scraping real de
  // https://autos.mercadolibre.com.mx/${marca}-${modelo}/${anio}
  return [
    {
      titulo: `${marca} ${modelo} ${anio} (ejemplo Mercado Libre)`,
      precio: 185000,
      foto: 'https://placehold.co/400x300?text=Mercado+Libre',
      fuente: 'Mercado Libre',
      distanciaKm: 4.2,
    },
    {
      titulo: `${marca} ${modelo} ${anio} versión GT (ejemplo)`,
      precio: 210000,
      foto: 'https://placehold.co/400x300?text=Mercado+Libre',
      fuente: 'Mercado Libre',
      distanciaKm: 11.8,
    },
  ];
}

// ------------------------------------------------------------
// FUENTE 2: Seminuevos.com — FASE 2: scraping real
// ------------------------------------------------------------
// Cómo se armó esto:
// 1) La URL de búsqueda de Seminuevos sigue el patrón:
//    https://www.seminuevos.com/usados/-/autos/-/{marca}/{modelo}
//    (todo en minúsculas, espacios como "+")
// 2) Cada anuncio en la página de resultados es un link
//    <a href="/vehicle/...-marca-modelo-ciudad-anio/ID">, y el TEXTO
//    de ese link trae todo pegado, en este orden:
//    Ciudad + Año + Marca · Modelo Versión + Kilometraje "km" +
//    Transmisión + "$" + Precio
//    Ejemplo real: "Guadalajara2019Ford · Mustang2.3 L4 Ecoboost At25,000 km·Automática$467,000"
// 3) En vez de depender de nombres de clases CSS (que cambian con
//    rediseños del sitio), sacamos año/km/precio con expresiones
//    regulares sobre ese texto — es más resistente a cambios visuales.
async function buscarEnSeminuevos({ marca, modelo, anio }) {
  const marcaSlug = marca.toLowerCase().trim().replace(/\s+/g, '+');
  const modeloSlug = modelo.toLowerCase().trim().replace(/\s+/g, '+');
  const url = `https://www.seminuevos.com/usados/-/autos/-/${marcaSlug}/${modeloSlug}`;

  const response = await fetch(url, {
    headers: {
      // Algunos sitios bloquean peticiones sin un User-Agent de
      // navegador "creíble". Esto no es engañar al sitio de forma
      // maliciosa, es lo mínimo para que no descarte la petición
      // por venir de un script sin identificar.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    console.error(`Seminuevos respondió ${response.status} para ${url}`);
    return [];
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const listings = [];

  $('a[href^="/vehicle/"]').each((_, el) => {
    const href = $(el).attr('href');
    const texto = $(el).text().trim();
    if (!texto) return;

    const yearMatch = texto.match(/(19|20)\d{2}/);
    const priceMatch = texto.match(/\$([\d,]+)/);
    const kmMatch = texto.match(/([\d,]+)\s*km/i);

    // Si no se pudo sacar año o precio, no es un anuncio válido
    // (puede ser un banner publicitario con el mismo patrón de link).
    if (!yearMatch || !priceMatch) return;

    const year = yearMatch[0];

    // Filtro por año: solo si el usuario pidió un año específico.
    if (anio && year !== String(anio)) return;

    const precio = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    const km = kmMatch ? parseInt(kmMatch[1].replace(/,/g, ''), 10) : null;

    // El texto trae todo pegado; le agregamos espacios donde
    // probablemente los rompió el HTML original, para que el título
    // se lea bien en la tarjeta.
    const titulo = texto
      .replace(/\$[\d,]+$/, '') // quita el precio del final
      .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ0-9])/g, '$1 $2') // separa palabra+MAYÚSCULA o palabra+número
      .trim();

    // La foto no viene en el mismo <a>, normalmente está en un
    // elemento hermano o contenedor padre. Buscamos la imagen más
    // cercana como mejor esfuerzo; si el diseño del sitio cambia,
    // esto puede regresar null y la tarjeta se ve sin imagen, pero
    // el resto de los datos sigue funcionando.
    const foto = $(el).closest('article, li, div').find('img').first().attr('src') || null;

    listings.push({
      titulo: titulo || `${marca} ${modelo} ${year}`,
      precio,
      km,
      foto,
      fuente: 'Seminuevos',
      distanciaKm: null, // Seminuevos no expone coordenadas en el listado; ver README
      link: `https://www.seminuevos.com${href}`,
    });
  });

  return listings;
}
