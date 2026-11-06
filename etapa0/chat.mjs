// Conversa no terminal. Uso: node chat.mjs [--provider gemini] [--assunto storia_antica]
// Comandos: /explicar  /facil  /dificil  /novo  /nivel  /sair
import './lib/env.mjs';
import { ROOT } from './lib/env.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { chat, availableProviders } from './lib/llm.mjs';
import { abertura, sistemaTurno, explicar, cefr } from './lib/prompts.mjs';
import { randomFromCategory } from './lib/wikipedia.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const L = JSON.parse(readFileSync(join(ROOT, 'languages/it.json'), 'utf8'));
const estadoF = join(ROOT, 'estado.json');
const estado = existsSync(estadoF) ? JSON.parse(readFileSync(estadoF, 'utf8'))
  : { nivel: 2.0, interesses: ['storia_antica', 'mitologia', 'storia_italia', 'cucina', 'arte'], provider: null };
const prov = arg('--provider') || estado.provider || availableProviders()[0];
if (!prov) { console.error('Nenhuma chave de API no etapa0/.env. Veja o README.'); process.exit(1); }
const salvar = () => writeFileSync(estadoF, JSON.stringify(estado, null, 2));

mkdirSync(join(ROOT, 'logs'), { recursive: true });
const logF = join(ROOT, 'logs', `${new Date().toISOString().slice(0, 10)}.jsonl`);
const log = (o) => appendFileSync(logF, JSON.stringify({ t: new Date().toISOString(), provider: prov, nivel: estado.nivel, ...o }) + '\n');

const C = { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', c: '\x1b[36m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const rl = createInterface({ input: process.stdin, output: process.stdout });
const linhas = rl[Symbol.asyncIterator]();
const perguntar = async (q) => { process.stdout.write(q); const n = await linhas.next(); return n.done ? '/sair' : n.value; };
let hist = [], ultima = '', custoTotal = 0;

async function novaConversa() {
  const chave = arg('--assunto') || estado.interesses[Math.floor(Math.random() * estado.interesses.length)];
  const a = L.assuntos[chave];
  let wiki = null;
  if (a?.categorias?.length) {
    try { wiki = await randomFromCategory(L.wikipedia, a.categorias[Math.floor(Math.random() * a.categorias.length)]); }
    catch (e) { console.log(`${C.d}(Wikipedia falhou: ${e.message}; usando memória do modelo)${C.x}`); }
  }
  const r = await chat(prov, abertura(L, estado.nivel, a?.nome || chave, wiki), { kind: 'abertura', temperature: 0.8 });
  custoTotal += r.custo || 0;
  const d = r.data || { mensagem: r.text, vocabulario_previo: [] };
  console.log(`\n${C.b}── ${d.assunto || a?.nome} ${C.d}[${cefr(estado.nivel)} · ${prov}]${C.x}${wiki ? `\n${C.d}fonte: ${wiki.url}${C.x}` : ''}`);
  if (d.vocabulario_previo?.length) console.log(`${C.c}Palavras novas: ${d.vocabulario_previo.map((v) => `${v.termo} = ${v.traducao}`).join(' · ')}${C.x}`);
  console.log(`\n${d.mensagem}\n`);
  hist = [{ role: 'assistant', content: d.mensagem }];
  ultima = d.mensagem;
  log({ evento: 'abertura', assunto: chave, wiki: wiki?.title, dados: d, usage: r.usage, ms: r.ms });
}

function ajustar(delta, motivo) {
  estado.nivel = Math.min(6, Math.max(1, estado.nivel + delta));
  salvar();
  log({ evento: 'nivel', motivo, novo: estado.nivel });
  console.log(`${C.y}Nível agora: ${cefr(estado.nivel)} (${estado.nivel.toFixed(1)}). Vale a partir da próxima mensagem.${C.x}`);
}

console.log(`${C.d}Comandos: /explicar /facil /dificil /novo /nivel /sair${C.x}`);
await novaConversa();

while (true) {
  const msg = (await perguntar(`${C.b}você> ${C.x}`)).trim();
  if (!msg) continue;
  if (msg === '/sair') break;
  if (msg === '/novo') { await novaConversa(); continue; }
  if (msg === '/facil') { ajustar(+0.5, 'facil'); continue; }
  if (msg === '/dificil') { ajustar(-0.5, 'dificil'); continue; }
  if (msg === '/nivel') { console.log(`${cefr(estado.nivel)} (${estado.nivel.toFixed(1)}) · custo da sessão: US$ ${custoTotal.toFixed(4)}`); continue; }
  if (msg === '/explicar') {
    const r = await chat(prov, explicar(L, estado.nivel, ultima), { kind: 'explicar' });
    custoTotal += r.custo || 0;
    const d = r.data || {};
    console.log(`\n${C.c}${C.b}Tradução:${C.x} ${d.traducao}`);
    (d.palavras || []).forEach((p) => console.log(`  ${C.c}${p.termo}${C.x} (${p.classe}) = ${p.traducao}`));
    (d.gramatica || []).forEach((g) => console.log(`  ${C.y}• ${g}${C.x}`));
    (d.expressoes || []).forEach((e) => console.log(`  ${C.g}"${e.expressao}"${C.x}: ${e.significado}`));
    console.log();
    log({ evento: 'explicar', frase: ultima, usage: r.usage });
    continue;
  }

  hist.push({ role: 'user', content: msg });
  const r = await chat(prov, [{ role: 'system', content: sistemaTurno(L, estado.nivel) }, ...hist.slice(-12)]);
  custoTotal += r.custo || 0;
  const d = r.data;
  if (!d) { console.log(`${C.r}(resposta fora do formato)${C.x}\n${r.text}\n`); hist.pop(); continue; }
  if (d.idioma_detectado === 'pt') console.log(`${C.y}Em italiano: ${d.texto_corrigido}${C.x}`);
  else if (!d.correcoes?.length) console.log(`${C.g}✓ Sem correções${C.x}`);
  else {
    console.log(`${C.d}corrigido:${C.x} ${d.texto_corrigido}`);
    d.correcoes.forEach((c) => console.log(`  ${c.tipo === 'erro' ? C.r + '✗' : C.y + '~'} ${c.original} → ${c.corrigido}${C.x} ${C.d}(${c.categoria})${C.x} ${c.explicacao}`));
  }
  console.log(`\n${d.resposta}`);
  if (d.vocabulario_novo?.length) console.log(`${C.c}${d.vocabulario_novo.map((v) => `${v.termo} = ${v.traducao}`).join(' · ')}${C.x}`);
  console.log();
  hist.push({ role: 'assistant', content: d.resposta });
  ultima = d.resposta;
  log({ evento: 'turno', usuario: msg, dados: d, usage: r.usage, ms: r.ms });
}
salvar();
console.log(`Ciao! Custo estimado da sessão: US$ ${custoTotal.toFixed(4)} · log: ${logF}`);
rl.close();
