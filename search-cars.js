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
// FUENTE 2: Seminuevos.com
// ------------------------------------------------------------
async function buscarEnSeminuevos({ marca, modelo, anio }) {
  // TODO Fase 2: reemplazar por scraping real de
  // https://www.seminuevos.com/autos/${marca}-${modelo}?year=${anio}
  return [
    {
      titulo: `${marca} ${modelo} ${anio} (ejemplo Seminuevos)`,
      precio: 172000,
      foto: 'https://placehold.co/400x300?text=Seminuevos',
      fuente: 'Seminuevos',
      distanciaKm: 7.5,
    },
  ];
}
