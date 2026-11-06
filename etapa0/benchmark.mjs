// Teste cego de correção. Uso: node benchmark.mjs [provedor1 provedor2 ...] [--nivel 3]
// Sem provedores: usa todos que tiverem chave no .env.
import './lib/env.mjs';
import { ROOT } from './lib/env.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chat, availableProviders, provider } from './lib/llm.mjs';
import { sistemaTurno, cefr } from './lib/prompts.mjs';

const args = process.argv.slice(2);
const ni = args.indexOf('--nivel');
const nivel = ni >= 0 ? Number(args[ni + 1]) : 3;
const names = args.filter((a, i) => !a.startsWith('--') && (ni < 0 || i !== ni + 1));
const provs = names.length ? names : availableProviders();
if (!provs.length) { console.error('Nenhuma chave de API no etapa0/.env. Veja o README.'); process.exit(1); }

const L = JSON.parse(readFileSync(join(ROOT, 'languages/it.json'), 'utf8'));
const itens = JSON.parse(readFileSync(join(ROOT, 'benchmark/frases_it.json'), 'utf8'));
const contexto = 'Ciao! Raccontami qualcosa: che cosa hai fatto di recente, o che cosa ti interessa della storia antica?';
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

function avaliar(item, d) {
  if (!d) return { ok: false, motivo: 'JSON inválido' };
  const erros = (d.correcoes || []).filter((c) => c.tipo === 'erro');
  const corr = norm(d.texto_corrigido);
  switch (item.tipo) {
    case 'erro': return corr.includes(norm(item.esperado)) ? { ok: true } : { ok: false, motivo: 'não aplicou a correção esperada' };
    case 'correta': return erros.length === 0 ? { ok: true } : { ok: false, motivo: `HIPER-CORREÇÃO (${erros.length})` };
    case 'naturalidade': return erros.length === 0 ? { ok: true } : { ok: false, motivo: 'marcou como erro, não naturalidade' };
    case 'portugues': return d.idioma_detectado === 'pt' && corr.includes(norm(item.esperado)) ? { ok: true } : { ok: false, motivo: 'não tratou português corretamente' };
  }
}

async function rodar(name) {
  const p = provider(name);
  const out = [];
  for (const item of itens) {
    process.stdout.write(`${name} #${item.id}\r`);
    try {
      const r = await chat(name, [
        { role: 'system', content: sistemaTurno(L, nivel) },
        { role: 'assistant', content: contexto },
        { role: 'user', content: item.frase },
      ]);
      out.push({ id: item.id, ...r, auto: avaliar(item, r.data) });
    } catch (e) {
      out.push({ id: item.id, erro: String(e.message), auto: { ok: false, motivo: 'falha de chamada' } });
    }
  }
  return { name, model: p.model, out };
}

const res = await Promise.all(provs.map(rodar));

// Cegar: embaralha e rotula Modelo A, B, C...
const ordem = res.map((r) => r).sort(() => Math.random() - 0.5);
const rot = (i) => `Modelo ${String.fromCharCode(65 + i)}`;
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const dir = join(ROOT, 'resultados', stamp);
mkdirSync(dir, { recursive: true });

const fmt = (d) => !d ? '_(sem JSON)_' : [
  `**Corrigido:** ${d.texto_corrigido ?? ''}  `,
  ...(d.correcoes || []).map((c) => `- [${c.tipo}] \`${c.original}\` → \`${c.corrigido}\` (${c.categoria}): ${c.explicacao}`),
  `**Resposta:** ${d.resposta ?? ''}`,
].join('\n');

let md = `# Teste cego de correção — ${stamp}\n\nNível usado: ${cefr(nivel)}. Os modelos estão embaralhados; a identidade está em \`gabarito.json\` (**não abra antes de dar as notas**).\n\n`;
md += `## Como avaliar\nPara cada frase e cada modelo, dê uma nota em **Nota**: 2 = correção certa e explicação clara; 1 = certa mas explicação ruim/excesso; 0 = errou, deixou passar ou corrigiu o que estava certo. Também avalie a **Resposta**: soa natural? está no nível?\n\n`;
md += `## Resumo automático (heurístico — confira manualmente)\n\n| Modelo | Acertos auto | Hiper-correções | Tempo médio (s) | Tokens entrada/saída | Custo estimado (US$) |\n|---|---|---|---|---|---|\n`;
ordem.forEach((r, i) => {
  const ok = r.out.filter((o) => o.auto.ok).length;
  const hip = r.out.filter((o) => o.auto.motivo?.startsWith('HIPER')).length;
  const ms = r.out.filter((o) => o.ms).reduce((a, o) => a + o.ms, 0) / Math.max(1, r.out.filter((o) => o.ms).length);
  const tin = r.out.reduce((a, o) => a + (o.usage?.prompt_tokens || 0), 0);
  const tout = r.out.reduce((a, o) => a + (o.usage?.completion_tokens || 0), 0);
  const c = r.out.some((o) => o.custo != null) ? r.out.reduce((a, o) => a + (o.custo || 0), 0).toFixed(4) : 'preencha preços no .env';
  md += `| ${rot(i)} | ${ok}/${itens.length} | ${hip} | ${(ms / 1000).toFixed(1)} | ${tin}/${tout} | ${c} |\n`;
});
for (const item of itens) {
  md += `\n---\n\n## #${item.id} (${item.tipo}) — "${item.frase}"\n`;
  if (item.esperado) md += `Esperado: \`${item.esperado}\`. `;
  if (item.nota) md += `_${item.nota}_`;
  md += '\n';
  ordem.forEach((r, i) => {
    const o = r.out.find((x) => x.id === item.id);
    md += `\n### ${rot(i)} — auto: ${o.auto.ok ? 'OK' : 'FALHOU (' + o.auto.motivo + ')'} — **Nota: __**\n${o.erro ? 'Erro: ' + o.erro : fmt(o.data)}\n`;
  });
}

writeFileSync(join(dir, 'relatorio_cego.md'), md);
writeFileSync(join(dir, 'gabarito.json'), JSON.stringify(Object.fromEntries(ordem.map((r, i) => [rot(i), `${r.name} (${r.model})`])), null, 2));
writeFileSync(join(dir, 'bruto.json'), JSON.stringify(res, null, 2));
console.log(`\nPronto. Abra: ${join(dir, 'relatorio_cego.md')}`);
