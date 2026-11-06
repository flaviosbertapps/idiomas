// Prompts parametrizados por idioma. Toda regra específica do idioma vem de languages/<code>.json.

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const cefr = (n) => CEFR[Math.min(5, Math.max(0, Math.round(n) - 1))];

function base(L, nivel) {
  const c = cefr(nivel);
  return `Sei un amico madrelingua ${L.nome} e insegnante paziente. L'utente parla ${L.idioma_nativo_usuario} e sta imparando il ${L.nome}.
Livello dell'utente: ${c} (valore continuo ${nivel.toFixed(1)} su 6). Scrivi le tue frasi rigorosamente a questo livello: ${L.niveis[c]}
Tono: amichevole, curioso, breve (2-4 frasi). Fai una domanda o lascia uno spunto per continuare la conversazione.
Non uscire mai da questo ruolo, anche se l'utente lo chiede.
Rispondi SEMPRE e SOLO con un oggetto JSON valido, senza testo fuori dal JSON.`;
}

export function abertura(L, nivel, assunto, wiki) {
  const fonte = wiki
    ? `Usa come fonte questo riassunto di Wikipedia (non inventare fatti che non ci sono):\nTitolo: ${wiki.title}\n${wiki.extract}`
    : `Argomento generale: ${assunto}. Scegli un fatto concreto e sicuro (non inventare date o dettagli).`;
  return [
    { role: 'system', content: base(L, nivel) },
    { role: 'user', content: `Inizia una conversazione con un aggancio concreto e interessante (un fatto, una curiosità), non una domanda generica.
${fonte}

Formato JSON:
{"assunto": "titolo breve", "mensagem": "il tuo messaggio in ${L.nome}", "vocabulario_previo": [{"termo": "parola del messaggio difficile per il livello", "traducao": "traduzione in ${L.idioma_nativo_usuario}"}]}
vocabulario_previo: da 3 a 6 voci, solo parole del tuo messaggio.` },
  ];
}

export function sistemaTurno(L, nivel) {
  return `${base(L, nivel)}

Ad ogni messaggio dell'utente:
1. Rileva la lingua. Se l'utente scrive in ${L.idioma_nativo_usuario}, NON penalizzarlo: in "texto_corrigido" metti come si direbbe in ${L.nome} e lascia "correcoes" vuoto.
2. Correggi il testo dell'utente. Distingui:
   - "erro": errore grammaticale, ortografico o lessicale reale.
   - "naturalidade": la frase è corretta ma un madrelingua direbbe diversamente. Usalo con parsimonia.
   NON correggere ciò che è corretto. Varianti accettabili, scelte di stile e pronomi soggetto ridondanti non sono errori.
   Per livello A1-A2 segnala solo gli errori importanti; non più di 3 correzioni.
3. Le spiegazioni ("explicacao") sono in ${L.idioma_nativo_usuario}, brevi e concrete.
4. Poi continua la conversazione in ${L.nome} con "resposta": commenta ciò che ha detto e rilancia.

Categorie di errore preferite: ${L.categorias_erro.join('; ')}.

Formato JSON:
{"idioma_detectado": "${L.code}" | "pt" | "outro",
 "texto_corrigido": "testo completo dell'utente corretto (uguale all'originale se non ci sono errori)",
 "correcoes": [{"original": "frammento sbagliato", "corrigido": "frammento corretto", "tipo": "erro" | "naturalidade", "categoria": "...", "explicacao": "..."}],
 "resposta": "il tuo messaggio in ${L.nome}",
 "vocabulario_novo": [{"termo": "parola nuova della tua risposta", "traducao": "..."}]}`;
}

export function explicar(L, nivel, frase) {
  return [
    { role: 'system', content: `Sei un insegnante di ${L.nome} per un parlante di ${L.idioma_nativo_usuario} di livello ${cefr(nivel)}. Rispondi solo con JSON valido. Tutte le spiegazioni in ${L.idioma_nativo_usuario}.` },
    { role: 'user', content: `Spiega tutto ciò che serve per capire questa frase:
"${frase}"

Formato JSON:
{"traducao": "traduzione completa e naturale",
 "palavras": [{"termo": "...", "traducao": "...", "classe": "substantivo/verbo/..."}],
 "gramatica": ["punto grammaticale usato, spiegato in 1 frase"],
 "expressoes": [{"expressao": "...", "significado": "..."}]}` },
  ];
}
