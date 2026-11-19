// "Adventures near you" – caching demo for the AEM Edge Function /api/nearby
// Shows both cache layers:
//   OUTER – CDN cache: stores the function's reply (x-cache / age headers, generated time)
//   INNER – fetch cache: stores what the function fetched from the origin (query-index.json)

const EDGE_HOSTS = {
  sandbox: 'https://publish-p233852-e2376453.adobeaemcloud.com', // publish CDN: cdn.yaml rules + CDN cache
  debug: 'https://edgefunction-p233852-e2376453-my-edge-function.adobeaemcloud.com', // function directly, no CDN cache
  local: 'http://127.0.0.1:7676', // aio aem edge-functions serve
};

function edgeHost() {
  const { hostname, search } = window.location;
  const override = new URLSearchParams(search).get('edge'); // ?edge=debug | sandbox | local
  if (override && EDGE_HOSTS[override]) return { name: override, url: EDGE_HOSTS[override] };
  if (hostname === 'localhost' || hostname === '127.0.0.1') return { name: 'local', url: EDGE_HOSTS.local };
  return { name: 'sandbox', url: EDGE_HOSTS.sandbox };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const time = (value) => (value ? new Date(value).toLocaleTimeString() : '–');
const secondsSince = (value) => {
  if (!value) return 0;
  return Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000));
};

function renderCards(list, adventures) {
  list.textContent = '';
  adventures.forEach((a) => {
    const li = el('li', 'nearby-adventures-card');
    const link = el('a');
    link.href = a.path;
    if (a.image) {
      const img = el('img');
      img.src = a.image;
      img.alt = '';
      img.loading = 'lazy';
      link.append(img);
    }
    link.append(el('strong', '', a.title), el('span', '', `${a.km.toLocaleString()} km away`));
    li.append(link);
    list.append(li);
  });
}

function layerRow(name, stores, status, details, hit) {
  const row = el('div', `nearby-adventures-layer ${hit ? 'hit' : 'miss'}`);
  row.append(el('strong', '', name), el('span', 'stores', stores), el('span', 'status', status), el('span', 'details', details));
  return row;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const ip = new URLSearchParams(window.location.search).get('ip'); // try another city (debug host only)
  block.textContent = '';
  const heading = el('h3', '', 'Adventures near you');
  const list = el('ul', 'nearby-adventures-list');
  const layers = el('div', 'nearby-adventures-layers');
  const meta = el('p', 'nearby-adventures-meta');
  const refresh = el('button', 'button primary', 'Refresh');
  refresh.type = 'button';

  async function load() {
    const host = edgeHost();
    const url = new URL('/api/nearby', host.url);
    if (ip) url.searchParams.set('ip', ip);
    meta.textContent = 'Asking the edge…';
    block.classList.remove('error');
    const started = performance.now();
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const ms = Math.round(performance.now() - started);
      const xCache = (resp.headers.get('x-cache') || '').split(',').pop().trim(); // last hop = closest to you
      const age = resp.headers.get('age');
      const outer = data.outer || { generatedAt: data.generatedAt, pop: data.pop };
      const inner = data.inner || { fetchMs: data.indexFetchMs };
      const outerHit = host.name === 'sandbox' && xCache === 'HIT'; // only the publish CDN caches
      const innerHit = typeof inner.fetchMs === 'number' && inner.fetchMs < 20;

      const city = (data.city || '').replace(/\b\w/g, (c) => c.toUpperCase()); // geolocation gives lower case
      heading.textContent = city ? `Adventures near ${city}` : 'Adventures near you';
      renderCards(list, data.adventures || []);
      layers.textContent = '';
      layers.append(
        layerRow(
          'Outer – CDN cache',
          'stores the function\'s reply (this JSON, per visitor)',
          host.name === 'sandbox' ? `${xCache || 'no header'}${age ? ` · age ${age} s` : ''}` : 'skipped (debug / local)',
          `reply generated ${time(outer.generatedAt)} (${secondsSince(outer.generatedAt)} s ago) at ${outer.pop || '–'}`,
          outerHit,
        ),
        layerRow(
          'Inner – fetch cache',
          `stores what the function fetched: ${inner.stores || 'query-index.json'}${inner.pages ? ` (${inner.pages} pages, ${Math.round((inner.bytes || 0) / 1024)} KB)` : ''}`,
          `${innerHit ? 'HIT' : 'MISS'} · fetch ${inner.fetchMs} ms`,
          `copy fetched from the origin ${time(inner.fetchedFromOrigin)}${inner.fetchedFromOrigin ? ` (${secondsSince(inner.fetchedFromOrigin)} s ago)` : ''}`,
          innerHit,
        ),
      );
      meta.textContent = `Answered in ${ms} ms via ${host.name}${outerHit ? ' – the function did not run' : ''}`;
    } catch (e) {
      block.classList.add('error');
      meta.textContent = `Could not reach the edge function (${e.message}). Try ?edge=debug.`;
    }
  }

  refresh.addEventListener('click', load);
  block.append(heading, list, layers, meta, refresh);
  load();
}
