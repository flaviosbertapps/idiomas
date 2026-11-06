# Etapa 0 — Validação

Objetivo: decidir **qual IA usar** e descobrir **se a conversa é útil de verdade para você**, antes de construir o site.
Duração sugerida: 1–2 semanas. Custo esperado: poucos dólares (o Gemini tem faixa gratuita).

O que existe nesta pasta:

| Arquivo | Para quê |
|---|---|
| `benchmark.mjs` | Teste cego: 32 frases (20 com erro, 9 corretas, 1 de naturalidade, 2 em português) enviadas a cada IA. Gera um relatório com os modelos embaralhados. |
| `chat.mjs` | Conversa no terminal, igual à ideia do app: abre com um assunto da Wikipedia, corrige, responde, explica. |
| `checar_wikipedia.mjs` | Confere se as categorias de assuntos existem na Wikipedia italiana. |
| `languages/it.json` | Tudo que é específico do italiano (assuntos, categorias, níveis, tipos de erro). Novo idioma = novo arquivo. |
| `lib/prompts.mjs` | Os prompts. **É aqui que se itera** se as correções/respostas não estiverem boas. |
| `DIARIO.md` | Modelo para anotar o uso diário. |

> **Limite honesto:** escrevi e testei o código com um provedor simulado (`mock`). **Não consegui testar com as APIs reais nem com a Wikipedia** (a rede do ambiente onde escrevi bloqueia esses endereços, e não tenho suas chaves). Se algo falhar no primeiro uso, me mande a mensagem de erro completa.

---

## Passo 1 — Instalar o Node.js (uma vez, ~5 min)

1. Acesse https://nodejs.org e baixe a versão **LTS** (22 ou mais nova). Instale com as opções padrão.
2. Abra um terminal (Windows: "Prompt de Comando" ou "PowerShell"; Mac: "Terminal") e confira:
   ```bash
   node -v
   ```
   Deve aparecer `v22...` ou maior. Não é preciso instalar mais nada (sem `npm install`).

## Passo 2 — Baixar o projeto

Se você tem git:
```bash
git clone https://github.com/flaviosbertapps/idiomas.git
```
Sem git: no GitHub, botão verde **Code → Download ZIP**, e descompacte.

Depois entre na pasta:
```bash
cd idiomas/etapa0
```

## Passo 3 — Criar as chaves de API (~20 min)

Você precisa de **pelo menos duas** para a comparação fazer sentido; o ideal são três.
Cada chave é uma senha: não compartilhe, não cole em chat, não suba para o GitHub.

| Provedor | Onde | Custo para começar | Observações |
|---|---|---|---|
| **Gemini** (Google) | https://aistudio.google.com → "Get API key" | Grátis (faixa gratuita) | Entra com sua conta Google. Na faixa grátis, o Google pode usar seus textos para treinar modelos — irrelevante para frases de estudo. |
| **DeepSeek** | https://platform.deepseek.com → API Keys | Recarga mínima (alguns dólares) | Exige crédito antes de funcionar. Dados processados na China. |
| **OpenAI** | https://platform.openai.com → API keys | Crédito mínimo (~US$ 5) | Exige cartão. |
| Anthropic (opcional) | https://console.anthropic.com | Crédito mínimo | Mais caro; útil como referência de qualidade. |

Dica: em cada painel, **defina um limite de gasto mensal baixo** (ex.: US$ 5). Isso protege contra qualquer erro.

## Passo 4 — Configurar o `.env`

1. Na pasta `etapa0`, copie `.env.example` para um arquivo chamado `.env`:
   - Mac/Linux: `cp .env.example .env`
   - Windows: `copy .env.example .env`
2. Abra o `.env` num editor de texto (Bloco de Notas serve) e cole as chaves depois do `=`, sem espaços nem aspas:
   ```
   GEMINI_API_KEY=AIzaSy...
   ```
3. **Modelos:** os nomes padrão (`gemini-2.5-flash`, `deepseek-chat`, `gpt-4.1-mini`) podem estar desatualizados. Na página de cada provedor, veja o modelo **barato/rápido atual** e, se for outro, descomente a linha `..._MODEL=` com o nome certo. Compare modelos da **mesma faixa de preço**.
4. **Preços (recomendado):** copie das páginas de preço o valor por 1 milhão de tokens de entrada e de saída para as linhas `..._PRECO_...`. Assim o relatório mostra quanto custou.

O `.env` já está no `.gitignore` — não vai para o GitHub.

## Passo 5 — Conferir a Wikipedia

```bash
node checar_wikipedia.mjs
```
Cada linha deve mostrar `OK` com um exemplo de artigo. Se aparecer `VAZIA` ou `ERRO`, a categoria tem outro nome: procure em https://it.wikipedia.org o nome correto (ex.: "Categoria:Storia romana") e corrija em `languages/it.json`. Ou me mande a saída que eu corrijo.

## Passo 6 — Rodar o teste cego (~5 min de execução + ~40 min de avaliação)

```bash
node benchmark.mjs
```
Usa todos os provedores que têm chave. Para escolher: `node benchmark.mjs gemini deepseek`. Para mudar o nível (padrão B1): `--nivel 2` (A2).

Vai gerar `resultados/<data>/` com três arquivos:
- `relatorio_cego.md` — **abra este.**
- `gabarito.json` — qual "Modelo A/B/C" é qual. **Não abra antes de terminar as notas.**
- `bruto.json` — resposta completa (para eu analisar, se precisar).

Como avaliar o relatório:
1. O **resumo automático** no topo é heurístico (procura o trecho esperado no texto corrigido). Serve de triagem, não de veredito: pode marcar falha numa correção válida feita de outro jeito.
2. Para cada frase e modelo, preencha `Nota: __` com:
   - **2** = corrigiu certo e a explicação é clara;
   - **1** = certo, mas explicação confusa, ou corrigiu coisas demais;
   - **0** = errou, deixou passar ou "corrigiu" algo que estava certo.
3. Dê atenção especial a:
   - **Frases corretas (#21–29):** qualquer "correção" aqui é o defeito mais grave (hiper-correção), porque ensina errado.
   - **#26** ("Io ho visitato…"): o pronome redundante não é erro.
   - **#20** (congiuntivo): o indicativo é aceito na fala; veja se o modelo explica isso ou só impõe.
   - **#31–32** (português): deve mostrar como se diz em italiano, sem tratar como erro.
   - **Resposta:** soa como um italiano falaria? Está no nível pedido, ou complexa demais?
4. Some as notas por modelo. **Só então** abra o `gabarito.json`.
5. Recomendado: rode uma segunda vez com `--nivel 1` (A1) e veja só as **respostas**. Os modelos costumam escrever acima do nível pedido, e é aí que eles mais se diferenciam.

Regra de decisão sugerida: escolha o mais barato entre os que ficarem a até ~10% da maior nota, **desde que tenha zero ou quase zero hiper-correções**.

> Você não é nativo, então pode haver casos em que não tenha certeza da correção certa. Marque com `?` e me mande — ou confira num dicionário/gramática (ex.: Treccani: https://www.treccani.it).

## Passo 7 — Usar a conversa todo dia (1–2 semanas)

```bash
node chat.mjs --provider gemini
```
(Troque pelo provedor escolhido. Para forçar um assunto: `--assunto storia_antica`; as chaves estão em `languages/it.json`.)

Comandos durante a conversa:

| Comando | O que faz |
|---|---|
| `/explicar` | Tradução, palavras, gramática e expressões da última mensagem da IA |
| `/facil` | "Está fácil demais": sobe meio nível |
| `/dificil` | "Está difícil demais": desce meio nível |
| `/novo` | Novo assunto |
| `/nivel` | Mostra o nível atual e o custo da sessão |
| `/sair` | Encerra |

O nível começa em A2 e fica salvo em `estado.json`. Para mudar os assuntos sorteados, edite a lista `interesses` nesse arquivo (ele é criado no primeiro uso).
Cada sessão é registrada em `logs/<data>.jsonl`.

**Rotina:** 10–15 min por dia. Logo depois, 2 minutos preenchendo o `DIARIO.md`. Isso substitui, por enquanto, a notificação: anote se você **teve vontade** de abrir. Essa é a pergunta mais importante da etapa.

## Passo 8 — Me trazer os resultados

Ao final, me mande (pode ser colando aqui ou subindo para o repositório):
1. O `relatorio_cego.md` com as notas + o `gabarito.json`.
2. O `DIARIO.md` preenchido.
3. Opcional: os arquivos de `logs/`. Eles contêm só suas conversas de estudo, mas revise antes de compartilhar.
4. Seu celular é **iPhone ou Android**? Isso define como faremos a notificação na Etapa 3.

Com isso eu: fecho a escolha do provedor, ajusto os prompts para os problemas que aparecerem e decidimos se seguimos para a Etapa 1.

### Critérios de saída da Etapa 0
- [ ] Um provedor com notas altas e hiper-correção praticamente zero.
- [ ] Respostas no nível certo (sobretudo A1–A2).
- [ ] Você usou ≥ 5 dias e quis continuar. **Se não quis, paramos e repensamos antes de construir qualquer coisa.**

---

## Problemas comuns
- `Falta GEMINI_API_KEY...` → chave não está no `.env`, ou o arquivo está com outro nome (no Windows, cuidado com `.env.txt`).
- `HTTP 401` → chave errada. `HTTP 402`/`insufficient balance` → falta crédito (DeepSeek/OpenAI). `HTTP 404` + nome de modelo → nome do modelo mudou; ajuste `..._MODEL`. `HTTP 429` → limite de uso; espere ou reduza os provedores.
- `(resposta fora do formato)` → o modelo não devolveu JSON. Ocasional é aceitável; frequente é um ponto contra ele.
- `Wikipedia falhou` → a conversa segue usando a memória do modelo; rode `checar_wikipedia.mjs`.
