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
// datos reales todavía.
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

async function buscarEnMercadoLibre({ marca, modelo, anio }) {
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

async function buscarEnSeminuevos({ marca, modelo, anio }) {
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
