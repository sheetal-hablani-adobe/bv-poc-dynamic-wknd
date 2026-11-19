// "Adventures near you" – caching demo for the AEM Edge Function /api/nearby
// The reply shows when it was generated and where, so the audience can see the CDN cache:
// same "generated at" + growing age = served from the CDN cache, without running the function.

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

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const ip = new URLSearchParams(window.location.search).get('ip'); // try another city (debug host only)
  block.textContent = '';
  const heading = el('h3', '', 'Adventures near you');
  const list = el('ul', 'nearby-adventures-list');
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
      const ageSec = Math.max(0, Math.round((Date.now() - Date.parse(data.generatedAt)) / 1000));
      heading.textContent = data.city ? `Adventures near ${data.city}` : 'Adventures near you';
      renderCards(list, data.adventures || []);
      meta.textContent = `Answered in ${ms} ms · generated ${new Date(data.generatedAt).toLocaleTimeString()} `
        + `(${ageSec} s ago) at CDN location ${data.pop} · query-index fetch ${data.indexFetchMs} ms · via ${host.name}`;
    } catch (e) {
      block.classList.add('error');
      meta.textContent = `Could not reach the edge function (${e.message}). Try ?edge=debug.`;
    }
  }

  refresh.addEventListener('click', load);
  block.append(heading, list, meta, refresh);
  load();
}
