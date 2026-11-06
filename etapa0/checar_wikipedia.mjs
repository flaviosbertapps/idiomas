// Verifica se as categorias de languages/it.json existem e têm artigos. Uso: node checar_wikipedia.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/env.mjs';
import { randomFromCategory } from './lib/wikipedia.mjs';

const L = JSON.parse(readFileSync(join(ROOT, 'languages/it.json'), 'utf8'));
for (const [chave, a] of Object.entries(L.assuntos)) {
  for (const cat of a.categorias) {
    try {
      const r = await randomFromCategory(L.wikipedia, cat);
      console.log(r ? `OK     ${cat}  → ex.: ${r.title}` : `VAZIA  ${cat}  (corrigir nome em languages/it.json)`);
    } catch (e) { console.log(`ERRO   ${cat}: ${e.message}`); }
  }
}
