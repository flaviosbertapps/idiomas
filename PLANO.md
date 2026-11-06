# Plano — App de conversação para aprendizado de idiomas

> Status: planejamento. Nada construído ainda. Idioma inicial: italiano (`it`). Tudo parametrizado por `language_code`.

## Decisões tomadas
- **Público:** uso pessoal na validação; arquitetura preparada para multiusuário e monetização futura (auth, isolamento por usuário, limites de uso desde o início — barato de fazer agora, caro de adaptar depois).
- **Plataforma:** página web (PWA) com notificação push na validação; app nativo depois, **só se a PWA se mostrar insuficiente**.
  - Atenção: no iPhone, push em PWA só funciona com o site adicionado à tela inicial (iOS 16.4+). Se seu celular é iPhone, isso precisa ser testado na Etapa 0/3.
  - Para não reescrever na migração: lógica toda no backend (API), frontend fino. Um app nativo futuro (ex.: React Native/Expo) reusa a mesma API; push migra de Web Push para FCM/APNs.
- **LGPD/privacidade:** baixa prioridade enquanto for pessoal; obrigatória antes de abrir para terceiros (Etapa 5). Isso também reduz o peso do contra de privacidade da DeepSeek na fase de validação.
- **Assuntos:** lista inicial na seção 3.1.

---

## 1. Crítica da ideia (antes de planejar)

### 1.1 O problema mais sério: "o amigo que vem conversar" não funciona num website puro
A proposta de valor é o app **tomar a iniciativa** ("ele manda uma mensagem"). Um website só fala quando o usuário o abre. Sem isso, o produto vira "mais um chat com IA", e o usuário pode simplesmente abrir o ChatGPT e pedir o mesmo.
- **Mitigação:** PWA com Web Push (funciona em Android/desktop; iOS só com o app instalado na tela inicial, iOS 16.4+) e/ou e-mail diário como fallback. Isso precisa estar no MVP, não "depois".
- Exige um job agendado no servidor que gera a mensagem do dia → o backend não pode ser só estático.

### 1.2 Diferencial frente ao ChatGPT/Gemini grátis
Qualquer LLM já conversa e corrige italiano. O que justifica o app existir:
1. Iniciativa (push diário) — ver acima.
2. **Memória pedagógica**: registro persistente dos erros recorrentes e vocabulário visto, reaproveitado nas conversas seguintes e em revisão espaçada.
3. Calibração de nível persistente.
4. UX de correção estruturada (diff visual), não um parágrafo de texto.

Se os itens 2 e 4 não forem bem feitos, o produto não tem razão de ser. Eles devem ser prioridade, não enfeite.

### 1.3 Correção: riscos reais
- **Hiper-correção**: LLMs "corrigem" frases já corretas ou trocam escolhas estilísticas válidas. Precisa distinguir *erro* vs *sugestão de naturalidade*.
- **Corrigir tudo desmotiva**. Para iniciantes, corrigir só os erros que impedem a compreensão ou que são do nível atual.
- **Usuário responde em português** (vai acontecer muito no começo). Precisa de comportamento definido: traduzir e mostrar como se diria em italiano, sem punir.
- Correção e resposta conversacional na mesma chamada saem mais baratas, mas misturam objetivos. Usar **saída JSON estruturada** numa única chamada: `{correcao: [...], resposta: "...", vocabulario_novo: [...]}`.

### 1.4 Calibração "fácil/difícil demais" é grosseira
Dois botões são um sinal fraco e o usuário raramente clica. Combinar com sinais implícitos:
- taxa de erros por mensagem;
- quantas vezes abriu o botão "me explica";
- tamanho/complexidade das respostas do usuário;
- uso de português na resposta.
Modelo de nível: escala CEFR (A1–C2) com subnível contínuo (ex.: 2.35), ajustado aos poucos. O botão explícito mexe mais forte, o sinal implícito mexe pouco.

### 1.5 "Assuntos de interesse" a serem definidos
Risco de repetição e de assuntos rasos. Cada mensagem inicial precisa de um **gancho concreto** (um fato, um evento, uma curiosidade), não "vamos falar de futebol?".

---

## 2. Decisão: API de IA — DeepSeek é a mais indicada?

**Não necessariamente. DeepSeek é barata, mas não é a única barata, e tem contras relevantes.**

| Critério | DeepSeek (V3.x chat) | Gemini Flash / Flash-Lite | GPT mini (OpenAI) | Claude Haiku |
|---|---|---|---|---|
| Custo | Muito baixo (com desconto de cache) | Muito baixo; **tier gratuito** útil para MVP | Baixo | Médio (mais caro do grupo) |
| Qualidade em italiano | Boa | Boa | Boa | Muito boa, bom em nuance/correção |
| JSON estruturado | Sim (JSON mode) | Sim (schema) | Sim (schema estrito) | Sim (tool use) |
| Privacidade / LGPD | **Ponto fraco**: dados processados na China; termos menos claros | Google (coerente com login Google) | EUA | EUA |
| Latência/estabilidade | Historicamente instável em picos | Boa | Boa | Boa |

> Preços mudam com frequência — conferir as páginas oficiais antes de decidir. A ordem de grandeza (frações de dólar por milhão de tokens nos modelos pequenos) é o que importa aqui.

**Recomendação:**
- Criar uma **camada de abstração de provedor** (`LLMProvider` com `generateTurn()`, `explain()`), para trocar de modelo sem reescrever nada. A maioria dos provedores aceita formato compatível com a API da OpenAI, o que facilita.
- **MVP:** Gemini Flash (tier grátis cobre o desenvolvimento e os primeiros usuários). DeepSeek como alternativa de custo se o volume crescer e a questão de privacidade for aceitável para o público.
- Fazer um **teste cego de qualidade de correção** antes de travar: 30 frases em italiano com erros conhecidos (e algumas corretas, para medir hiper-correção), rodar em 3 provedores, comparar. Isso vale mais do que a tabela acima.

**Estimativa de custo:** uma troca ≈ 1,5–3k tokens de entrada (prompt de sistema + histórico resumido) + ~400 de saída. Com 10 trocas/dia por usuário, fica na casa de centavos de dólar por usuário/mês em modelos pequenos. O custo de IA não é o gargalo; **o histórico crescendo sem controle é**. Resumir o histórico a cada N mensagens.

---

## 3. Decisão: fonte dos assuntos — Wikipedia ou memória do modelo?

**Wikipedia (it.wikipedia.org) é a melhor escolha, e é praticamente de graça.**
- A API é gratuita (só exige User-Agent identificável e respeito a limites de taxa).
- Conteúdo **já em italiano nativo**, o que é ótimo como insumo.
- Reduz alucinação de fatos (o modelo inventa datas e detalhes com frequência).
- Dá variedade: endpoints de "páginas aleatórias de uma categoria", "neste dia" (`/feed/onthisday`), destaque do dia (`/feed/featured`).
- Custo real: os tokens extras do trecho no prompt (~300–800 tokens). Mandar só o resumo (`/page/summary`), não o artigo inteiro.

**Memória do modelo** é "grátis" em tokens, mas repete assuntos, alucina e não traz nada atual. Usar só como fallback se a Wikipedia falhar.

### 3.1 Lista inicial de assuntos

Cada assunto mapeia para categorias da it.wikipedia (nomes a validar na API na Etapa 0 — categorias mudam). O usuário escolhe vários; o sistema alterna para evitar repetição.

| Chave | Assunto (UI) | Categorias it.wikipedia (ponto de partida) | Observação |
|---|---|---|---|
| `storia_antica` | História antiga | `Storia romana`, `Antica Grecia`, `Antico Egitto`, `Etruschi`, `Civiltà mesopotamiche` | Prioritário. Roma é natural para italiano; vocabulário rico, mas cuidado com nível A1–A2 (simplificar). |
| `storia_italia` | História da Itália | `Storia d'Italia`, `Rinascimento`, `Risorgimento` | Medieval, Renascimento, unificação. |
| `arte` | Arte e arquitetura | `Pittori italiani`, `Architettura romana`, `Musei d'Italia` | |
| `cucina` | Culinária | `Cucina italiana`, `Piatti regionali` | Ótimo para iniciantes: vocabulário concreto. |
| `geografia` | Cidades e regiões | `Regioni d'Italia`, `Città d'Italia` | Bom para planejar viagens. |
| `viaggi` | Viagem e cotidiano | (memória do modelo; situações práticas) | Diálogos úteis: hotel, restaurante, trem. Wikipedia ajuda pouco aqui. |
| `cinema_musica` | Cinema e música | `Film italiani`, `Cantanti italiani`, `Opera lirica` | |
| `scienza` | Ciência e invenções | `Scienziati italiani`, `Invenzioni` | Galileu, Volta, Marconi. |
| `mitologia` | Mitologia greco-romana | `Mitologia romana`, `Mitologia greca` | Complementa história antiga; ótimas narrativas. |
| `letteratura` | Literatura | `Scrittori italiani`, `Divina Commedia` | Mais indicado a partir de B1. |
| `sport` | Esporte | `Calcio in Italia`, `Ciclismo` | |
| `attualita` | Atualidades | (RSS de notícias, futuro) | Fora do MVP; depende de fonte com termos de uso compatíveis. |

Ganchos para variedade: `/feed/onthisday` ("neste dia na história") encaixa muito bem com história antiga/italiana.

Mapeamento: cada interesse do usuário → lista de categorias da Wikipedia por idioma (ex.: `cucina` → `Categoria:Cucina italiana`). Esse mapeamento fica em arquivo de configuração por idioma.

Futuro possível: RSS de notícias (ex.: ANSA) para assuntos atuais — verificar termos de uso.

---

## 4. Recursos de compreensão

Duas formas, as duas propostas fazem sentido e não se excluem:

1. **Pré-introdução (opcional, configurável):** antes da mensagem, 3–6 palavras/expressões novas com tradução. Gerado na mesma chamada da mensagem (campo `vocabulario_previo`), sem custo extra.
2. **Botão "Entender" por mensagem:** abre um painel com:
   - tradução completa;
   - palavras-chave com tradução e classe gramatical;
   - pontos gramaticais usados (ex.: "*passato prossimo* com *essere*");
   - expressões idiomáticas.
   Gerado **sob demanda** (só se clicar), e salvo em cache para não pagar duas vezes.
3. **Toque numa palavra** → tradução rápida. Pode ser resolvido com um dicionário local ou com o mesmo payload do botão "Entender". Mais barato e mais usado que o botão completo.

Cada clique nesses recursos é **sinal de dificuldade** para a calibração (seção 1.4).

---

## 5. Arquitetura proposta

```
[PWA - Next.js/React]  ──>  [API backend (Next.js API routes ou serverless)]
        │                         │            │              │
   Web Push                LLMProvider    Wikipedia API   Banco (Postgres)
                                  │
                         Job agendado (cron) → gera mensagem diária → push
```

Sugestão de stack (pensando em custo zero/baixo no início):
- **Frontend + backend:** Next.js (TypeScript), hospedado em Vercel ou similar.
- **Auth Google + banco:** Supabase (Postgres + Auth com Google pronto + tier gratuito) **ou** Firebase (Auth Google + Firestore). Supabase é preferível pelo modelo relacional (erros, vocabulário, níveis se consultam melhor com SQL).
- **Cron:** cron da própria hospedagem ou Supabase scheduled functions.
- **Push:** Web Push com VAPID.

### Modelo de dados (inicial)
- `users` (id, google_id, nome, idioma_nativo, fuso_horario, horario_preferido)
- `languages` (code, nome, nome_nativo, config_json — categorias Wikipedia, regras de prompt)
- `user_languages` (user_id, language_code, nivel_cefr, nivel_continuo, interesses[], pre_intro_ativada)
- `conversations` (id, user_id, language_code, assunto, fonte_url, resumo, criada_em)
- `messages` (id, conversation_id, autor, texto, correcao_json, explicacao_json_cache)
- `error_log` (user_id, language_code, tipo_erro, exemplo, contagem, ultima_vez)
- `vocabulary` (user_id, language_code, termo, traducao, visto_em, proxima_revisao)
- `feedback` (message_id, tipo: facil/dificil)

### Parametrização por idioma
Tudo que é específico do idioma vai para `languages.config_json` + arquivos de prompt por idioma:
- código da Wikipedia (`it`, `es`, `fr`...);
- mapeamento interesse → categorias;
- descrição dos níveis CEFR com exemplos de gramática esperada por nível;
- tipos de erro comuns (ex.: para italiano: artigos, concordância, *essere/avere*, preposições articuladas).
A interface (UI) também deve ser i18n, separando **idioma da interface** (português) de **idioma estudado**.

---

## 6. Etapas

### Etapa 0 — Validação (antes de escrever código do app)
- [ ] Teste cego de correção com 3 provedores (seção 2). Escolher o provedor.
- [ ] Escrever e iterar o prompt de sistema + schema JSON de saída num script simples.
- [ ] Testar o fluxo inteiro "na mão" por 1–2 semanas (você mesmo usando o script). Se não for útil para você, não vai ser para ninguém.
- **Critério de saída:** correções confiáveis (baixa hiper-correção) e conversa que você quer continuar.

### Etapa 1 — MVP de conversa (sem login)
- [ ] Projeto Next.js + camada `LLMProvider`.
- [ ] Integração Wikipedia (summary + categorias) com fallback para memória do modelo.
- [ ] Tela de chat: mensagem inicial com gancho → resposta do usuário → correção visual (diff) + nova mensagem.
- [ ] Botão "Entender" sob demanda, com cache.
- [ ] Configurações em `localStorage` (interesses, nível inicial).
- **Critério de saída:** uma conversa completa funciona de ponta a ponta.

### Etapa 2 — Login Google e persistência
- [ ] Supabase: auth Google, tabelas da seção 5, regras de acesso (RLS).
- [ ] Onboarding: idioma, interesses, nível autodeclarado + mini teste de nivelamento (3–4 frases).
- [ ] Histórico de conversas e resumo automático de conversas longas.
- **Critério de saída:** usuário volta outro dia e continua de onde parou.

### Etapa 3 — Iniciativa (o "amigo que manda mensagem")
- [ ] PWA instalável (manifest + service worker).
- [ ] Web Push + job diário no horário preferido do usuário (respeitando fuso).
- [ ] Fallback por e-mail para quem não permitir push (ou iOS sem instalação).
- [ ] Controle de frequência e "pausar".
- **Critério de saída:** mensagem chega sem o usuário abrir o site.

### Etapa 4 — Calibração e memória pedagógica
- [ ] Botões "fácil demais / difícil demais".
- [ ] Sinais implícitos (erros, cliques em "Entender", uso de português) → ajuste do nível contínuo.
- [ ] `error_log` alimentando o prompt ("o usuário erra muito preposições articuladas; crie oportunidades para usá-las").
- [ ] Vocabulário visto → revisão espaçada leve, reaparecendo nas conversas.
- [ ] Toque em palavra para tradução rápida.
- **Critério de saída:** dá para mostrar ao usuário "seus erros mais comuns" e o nível mudando com o tempo.

### Etapa 5 — Multi-idioma e polimento
- [ ] Adicionar um segundo idioma (ex.: espanhol) **só trocando configuração** — é o teste de que a parametrização está certa.
- [ ] Áudio: TTS para ouvir a mensagem (Web Speech API, grátis) e, depois, entrada por voz.
- [ ] Limites de uso por usuário (proteção de custo e abuso).
- [ ] Política de privacidade/LGPD (obrigatória com login Google e envio de texto a terceiros).

---

## 7. Riscos e perguntas em aberto
- **Retenção:** apps de idioma perdem a maioria dos usuários na primeira semana. O push diário é a principal defesa; medir desde a Etapa 3.
- **Custo descontrolado:** sem limite de mensagens por usuário, um usuário (ou bot) pode gerar custo alto. Rate limit desde a Etapa 1.
- **Prompt injection:** o usuário pode tentar desviar o "professor". Baixo impacto, mas o prompt de sistema deve manter o papel.
- **Qualidade em níveis baixos (A1):** LLMs tendem a escrever acima do nível pedido. Validar com exemplos A1 reais na Etapa 0.
- **Em aberto:** lista inicial de interesses; o público é só você ou terceiros (muda a urgência de LGPD, custos e push); monetização (se houver, define se dá para usar um modelo mais caro e melhor).
