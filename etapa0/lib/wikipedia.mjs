// Busca um artigo aleatório de uma categoria da Wikipedia e devolve o resumo.
const UA = 'idiomas-etapa0/0.1 (uso pessoal; https://github.com/flaviosbertapps/idiomas)';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!r.ok) throw new Error(`Wikipedia HTTP ${r.status}`);
  return r.json();
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function members(lang, cat) {
  const u = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  Object.entries({ action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: 'page|subcat', cmlimit: '200', format: 'json' })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  return (await get(u)).query?.categorymembers ?? [];
}

export async function summary(lang, title) {
  const s = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  return { title: s.title, extract: s.extract, url: s.content_urls?.desktop?.page };
}

export async function randomFromCategory(lang, cat, depth = 2) {
  const m = await members(lang, cat);
  const pages = m.filter((x) => x.ns === 0);
  const subs = m.filter((x) => x.ns === 14);
  if (depth > 0 && subs.length && (!pages.length || Math.random() < 0.4)) {
    const r = await randomFromCategory(lang, pick(subs).title, depth - 1);
    if (r) return r;
  }
  if (!pages.length) return null;
  for (let i = 0; i < 3; i++) {
    const s = await summary(lang, pick(pages).title);
    if (s.extract && s.extract.length > 200) return s; // evita artigos vazios/curtos
  }
  return null;
}
