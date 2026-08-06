// ============================================================
// KM0 — script.js
// Este archivo hace 3 cosas, en este orden:
//   1) Captura lo que escribes en el formulario y llama al backend
//   2) Con los anuncios que regresa el backend, calcula el precio
//      promedio de mercado y qué tan lejos está cada anuncio de ese
//      promedio
//   3) Dibuja las tarjetas de resultado en la página
// ============================================================

const form = document.getElementById('search-form');
const statusEl = document.getElementById('search-status');
const resultsEl = document.getElementById('results');
const emptyEl = document.getElementById('results-empty');
const summaryEl = document.getElementById('market-summary');
const avgPriceEl = document.getElementById('avg-price');
const totalResultsEl = document.getElementById('total-results');
const resaleEstimateEl = document.getElementById('resale-estimate');
const cardTemplate = document.getElementById('card-template');

// Endpoint del backend. En local con `netlify dev` esto funciona tal
// cual; una vez publicado en Netlify, la ruta /.netlify/functions/
// sigue siendo la misma.
const SEARCH_ENDPOINT = '/.netlify/functions/search-cars';

const formatMoney = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const marca = document.getElementById('marca').value.trim();
  const modelo = document.getElementById('modelo').value.trim();
  const anio = document.getElementById('anio').value.trim();

  await buscar({ marca, modelo, anio });
});

async function buscar({ marca, modelo, anio }) {
  setLoading(true);
  statusEl.textContent = `Buscando ${marca} ${modelo} ${anio} en Mercado Libre y Seminuevos…`;

  try {
    const params = new URLSearchParams({ marca, modelo, anio });
    const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`El backend respondió con estado ${response.status}`);
    }

    const data = await response.json();
    // data.listings es un array de objetos con esta forma:
    // { titulo, precio, foto, fuente, distanciaKm }
    const listings = data.listings || [];

    if (listings.length === 0) {
      statusEl.textContent = 'No se encontraron anuncios para esa búsqueda.';
      renderResults([]);
      summaryEl.hidden = true;
      return;
    }

    const enrichedListings = calcularComparacionDePrecios(listings);
    renderResults(enrichedListings);
    renderResumenDeMercado(enrichedListings);
    statusEl.textContent = `${listings.length} anuncios encontrados.`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Hubo un problema buscando. Intenta de nuevo en un momento.';
  } finally {
    setLoading(false);
  }
}

// ------------------------------------------------------------
// PASO 2: comparación de precios
// ------------------------------------------------------------
// Toma el array de anuncios, calcula el promedio de "precio",
// y le agrega a cada anuncio dos campos nuevos:
//   - deltaPct: qué tan abajo (negativo) o arriba (positivo) del
//     promedio está ese anuncio en particular
//   - estimadoReventa: el promedio de mercado, mostrado como
//     referencia de en cuánto se podría revender
// Esto es intencionalmente una función pura (no toca el DOM) para
// que puedas probarla por separado si quieres, por ejemplo, en la
// consola del navegador con datos de prueba.
function calcularComparacionDePrecios(listings) {
  const suma = listings.reduce((acc, item) => acc + item.precio, 0);
  const promedio = suma / listings.length;

  return listings
    .map((item) => {
      const deltaPct = ((item.precio - promedio) / promedio) * 100;
      return { ...item, deltaPct, promedioMercado: promedio };
    })
    // Se ordenan de más cerca a más lejos, como pide el proyecto.
    // Si el backend no manda distanciaKm (por ejemplo, mientras no
    // haya geolocalización activada), se van al final.
    .sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
}

// ------------------------------------------------------------
// PASO 3a: resumen de mercado (arriba de los resultados)
// ------------------------------------------------------------
function renderResumenDeMercado(listings) {
  const promedio = listings[0].promedioMercado;
  avgPriceEl.textContent = formatMoney(promedio);
  totalResultsEl.textContent = listings.length;
  resaleEstimateEl.textContent = `~${formatMoney(promedio)}`;
  summaryEl.hidden = false;
}

// ------------------------------------------------------------
// PASO 3b: tarjetas de resultado
// ------------------------------------------------------------
function renderResults(listings) {
  resultsEl.querySelectorAll('.car-card').forEach((card) => card.remove());
  emptyEl.hidden = listings.length > 0;

  listings.forEach((item) => {
    const node = cardTemplate.content.cloneNode(true);

    const img = node.querySelector('.car-card__image');
    img.src = item.foto || '';
    img.alt = item.titulo;

    node.querySelector('.car-card__source').textContent = item.fuente;
    node.querySelector('.car-card__title').textContent = item.titulo;
    node.querySelector('.car-card__price').textContent = formatMoney(item.precio);

    const deltaEl = node.querySelector('.car-card__delta');
    const deltaRedondeado = Math.round(item.deltaPct);
    const esBueno = item.deltaPct < 0; // negativo = por debajo del promedio = buen trato
    deltaEl.textContent = `${deltaRedondeado > 0 ? '+' : ''}${deltaRedondeado}% vs. promedio`;
    deltaEl.classList.add(esBueno ? 'car-card__delta--good' : 'car-card__delta--bad');

    // Mientras no haya geolocalización activa, mostramos el
    // kilometraje del auto en ese espacio si el backend lo mandó
    // (Seminuevos sí lo trae); si no hay ninguno de los dos, se
    // deja un guión.
    const distanciaTexto =
      item.distanciaKm != null
        ? `${Math.round(item.distanciaKm)} km de distancia`
        : item.km != null
        ? `${item.km.toLocaleString('es-MX')} km recorridos`
        : '—';
    node.querySelector('.car-card__distance').textContent = distanciaTexto;
    node.querySelector('.car-card__resale').textContent = `reventa est. ${formatMoney(item.promedioMercado)}`;

    // Si el anuncio trae un link al sitio original, la tarjeta
    // completa se vuelve clickeable para abrirlo. Usamos la misma
    // pestaña (en vez de window.open a una nueva) porque varios
    // navegadores de celular bloquean la apertura de pestañas nuevas
    // por seguridad, y así es más confiable.
    const cardEl = node.querySelector('.car-card');
    if (item.link) {
      cardEl.style.cursor = 'pointer';
      cardEl.addEventListener('click', () => {
        window.location.href = item.link;
      });
    }

    resultsEl.appendChild(node);
  });
}

function setLoading(isLoading) {
  form.querySelector('.btn-search').classList.toggle('is-loading', isLoading);
  form.querySelectorAll('input, button').forEach((el) => (el.disabled = isLoading));
                   }
