# Protótipo web — decisões

Página publicada (privada, só você abre): https://claude.ai/artifact/Hc3bh1Evs5s19m1sXbVJDR
Código-fonte: `prototipo/index.html` (um arquivo só, sem build).

## 1. IA sem chave de API: Claude via Artifact do claude.ai
**Decisão:** a página roda como Artifact do claude.ai e chama o Claude pela capacidade `sample` do próprio runtime, usando a **sua conta** do claude.ai.
- **Por quê:** você ainda não tem chaves. Isso permite usar hoje, sem cadastro, cartão ou `.env`.
- **Custo:** consome o limite de uso da sua assinatura do claude.ai, não cobra por token. Para um usuário só, é irrelevante.
- **Contras:**
  - Não serve para o produto final, porque cada usuário gastaria a própria conta do claude.ai.
  - Não ajuda a comparar provedores: o teste cego da `etapa0/` continua sendo o jeito de escolher a API do produto.
  - Exige estar logado no claude.ai e autorizar o uso na primeira mensagem.
- **Modelo:** "Correção mais cuidadosa" (padrão) usa o nível padrão do Claude, mais lento (5–30 s por resposta). Desligada, usa o nível rápido. "Entender esta frase" sempre usa o rápido.

## 2. Login e dados: conta do claude.ai em vez de Google (por enquanto)
**Decisão:** o login é o do claude.ai. Perfil, conversa atual, conversas arquivadas e contagem de erros ficam no banco do Artifact, em `data/users/<seu id>/`, que é privado por usuário. Fora do claude.ai, a página cai para `localStorage`.
- **Por quê:** o login Google exige backend próprio (Etapa 2). Na validação, ele não muda nada para você.
- **O que fica salvo:**
  - `perfil`: nível, interesses, preferências e assuntos recentes;
  - `erros`: contagem por categoria, com exemplos;
  - `atual`: conversa em andamento, até 40 mensagens;
  - `c_<id>`: conversas arquivadas ao trocar de assunto.

## 3. Assuntos: memória do modelo, não Wikipedia
**Decisão:** nesta versão, os assuntos vêm da memória do Claude.
- **Por quê:** o Artifact bloqueia qualquer acesso da página a sites externos (política de segurança), e isso inclui a Wikipedia.
- **Mitigações:**
  - o prompt proíbe inventar fatos, datas e nomes;
  - a página guarda os últimos 20 assuntos e pede ao modelo para não repeti-los.
- **Risco aceito:** algum fato errado de vez em quando. Para o protótipo, aprender o idioma importa mais que o fato. No produto, a Wikipedia volta (`etapa0/lib/wikipedia.mjs` já existe).

## 4. Calibração de nível
- "Fácil demais" e "Difícil demais" movem ±0,5. Também há um controle deslizante nos Ajustes.
- Sinais implícitos movem pouco:
  - −0,1 se você responde em português ou comete 3 ou mais erros;
  - +0,1 se responde com 10 ou mais palavras sem erros;
  - −0,05 a cada "Entender esta frase".
- Pesos chutados. Fica para revisar com o uso.

## 5. Memória pedagógica (antecipada da Etapa 4)
Os 3 erros mais frequentes vão no prompt de cada resposta, com a instrução de criar oportunidades de praticá-los. O painel "Meus erros" mostra a contagem. Foi antecipada porque custa quase nada e é o diferencial do produto (ver PLANO.md, 1.2).

## 6. Compreensão
- Palavras novas aparecem antes de cada mensagem (pode desligar nos Ajustes).
- O botão "Entender esta frase" gera tradução, palavras, gramática e expressões sob demanda. A explicação fica salva na conversa para não gerar de novo.

## 7. O que ficou de fora (de propósito)
- **Notificações:** Artifact não tem push. Continua na Etapa 3, com PWA própria. Por ora, anote no `etapa0/DIARIO.md` se você teve vontade de abrir.
- **Toque numa palavra para traduzir:** fica para depois. As palavras novas e o "Entender" cobrem o essencial.
- **Áudio e voz.**

## 8. Relação com a Etapa 0
Este protótipo valida **a experiência** (você quer conversar todo dia?). O teste cego (`etapa0/benchmark.mjs`) continua sendo o caminho para **escolher a API** do produto, porque é ela que vai pagar a conta quando houver outros usuários. Os prompts são os mesmos de `etapa0/lib/prompts.mjs`, adaptados para o formato do `sample`, que não tem prompt de sistema.
