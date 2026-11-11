// Calls the AEM Edge Function deployed on the publish CDN of program 233852 / environment 2376453
const EDGE_BASE = 'https://publish-p233852-e2376453.adobeaemcloud.com';

/**
 * Reads "key | value" rows from the block
 * @param {Element} block The block element
 * @returns {Object} lower-cased keys mapped to their text values
 */
function readConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const [key, value] = row.children;
    if (key && value) config[key.textContent.trim().toLowerCase()] = value.textContent.trim();
  });
  return config;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const config = readConfig(block);
  const endpoint = config.endpoint || '/hello-world';

  block.textContent = '';

  const heading = document.createElement('h3');
  heading.textContent = config.title || 'Live from the edge';

  const output = document.createElement('p');
  output.className = 'edge-demo-output';
  output.setAttribute('aria-live', 'polite');

  const meta = document.createElement('p');
  meta.className = 'edge-demo-meta';

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'button primary';
  refresh.textContent = 'Refresh';

  async function load() {
    block.classList.remove('error');
    output.textContent = 'Loading…';
    meta.textContent = '';
    const started = performance.now();
    try {
      const resp = await fetch(new URL(endpoint, EDGE_BASE), { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      output.textContent = await resp.text();
      meta.textContent = `${endpoint} · answered by the edge function in ${Math.round(performance.now() - started)} ms`;
    } catch (e) {
      block.classList.add('error');
      output.textContent = 'Could not reach the edge function.';
      meta.textContent = e.message;
    }
  }

  refresh.addEventListener('click', load);
  block.append(heading, output, meta, refresh);
  load();
}
