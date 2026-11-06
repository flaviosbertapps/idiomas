// Camada de provedor: todos usam o formato de chat compatível com a API da OpenAI.
// Trocar de modelo = trocar o nome do provedor. Modelos podem ser sobrescritos no .env.

const DEFS = {
  deepseek:  { url: 'https://api.deepseek.com/chat/completions', key: 'DEEPSEEK_API_KEY', model: 'deepseek-chat', json: true },
  gemini:    { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: 'GEMINI_API_KEY', model: 'gemini-2.5-flash', json: true },
  openai:    { url: 'https://api.openai.com/v1/chat/completions', key: 'OPENAI_API_KEY', model: 'gpt-4.1-mini', json: true },
  anthropic: { url: 'https://api.anthropic.com/v1/chat/completions', key: 'ANTHROPIC_API_KEY', model: 'claude-haiku-5-5', json: false },
  mock:      { mock: true, model: 'mock' },
};

export function provider(name) {
  const d = DEFS[name];
  if (!d) throw new Error(`Provedor desconhecido: ${name}. Opções: ${Object.keys(DEFS).join(', ')}`);
  const model = process.env[`${name.toUpperCase()}_MODEL`] || d.model;
  const price = {
    input: Number(process.env[`${name.toUpperCase()}_PRECO_ENTRADA`]) || null,
    output: Number(process.env[`${name.toUpperCase()}_PRECO_SAIDA`]) || null,
  };
  return { name, ...d, model, price, apiKey: d.key ? process.env[d.key] : 'mock' };
}

export function availableProviders() {
  return Object.keys(DEFS).filter((n) => n !== 'mock' && process.env[DEFS[n].key]);
}

export function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const s = text.replace(/```(?:json)?/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

export function cost(p, usage) {
  if (!usage || !p.price.input || !p.price.output) return null;
  return (usage.prompt_tokens * p.price.input + usage.completion_tokens * p.price.output) / 1e6;
}

export async function chat(name, messages, { kind = 'turno', temperature = 0.4 } = {}) {
  const p = provider(name);
  if (p.mock) return mock(kind);
  if (!p.apiKey) throw new Error(`Falta ${p.key} no etapa0/.env`);
  const body = { model: p.model, messages, temperature };
  if (p.json) body.response_format = { type: 'json_object' };
  if (name === 'anthropic') body.max_tokens = 2000;
  const t0 = Date.now();
  let res;
  for (let tent = 0; tent < 3; tent++) {
    res = await fetch(p.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify(body),
    });
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** tent));
  }
  const raw = await res.text();
  if (!res.ok) throw new Error(`${name} HTTP ${res.status}: ${raw.slice(0, 300)}`);
  const j = JSON.parse(raw);
  const text = j.choices?.[0]?.message?.content ?? '';
  return { data: parseJson(text), text, usage: j.usage, ms: Date.now() - t0, custo: cost(p, j.usage) };
}

function mock(kind) {
  const data = {
    abertura: { assunto: 'Il Colosseo', mensagem: 'Ciao! Sai che il Colosseo poteva contenere circa 50.000 spettatori? Secondo te, che cosa guardavano i Romani?', vocabulario_previo: [{ termo: 'spettatori', traducao: 'espectadores' }] },
    turno: { idioma_detectado: 'it', texto_corrigido: 'Sono andato al mercato.', correcoes: [{ original: 'ho andato', corrigido: 'sono andato', tipo: 'erro', categoria: 'ausiliare (essere/avere)', explicacao: 'Verbos de movimento como andare usam essere.' }], resposta: 'Bene! Che cosa hai comprato?', vocabulario_novo: [] },
    explicar: { traducao: 'Tradução de teste.', palavras: [{ termo: 'mercato', traducao: 'mercado', classe: 'substantivo' }], gramatica: ['passato prossimo'], expressoes: [] },
  }[kind];
  return Promise.resolve({ data, text: JSON.stringify(data), usage: { prompt_tokens: 0, completion_tokens: 0 }, ms: 0, custo: 0 });
}
