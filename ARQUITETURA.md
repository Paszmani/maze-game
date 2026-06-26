# Pac-Man de Estande — Decisão de Arquitetura

**Projeto:** Jogo de labirinto temático para totem/tablet em eventos corporativos
**Cliente interno:** Grupo Sudeste Banzai (GSB)
**Status:** Decisão de arquitetura — pré-implementação
**Data:** 26/06/2026

---

## TL;DR (a decisão)

- **Engine:** Phaser (3.8x estável; 4 já disponível em 2026 mas mais novo — comece no 3, é o mais documentado). Lógica do jogo escrita **agnóstica de engine** numa pasta `core/`, para que o Phaser seja só o renderizador/input.
- **Runtime de produção:** **Electron** em modo kiosk. O jogo roda como web app puro no navegador durante o dev, mas a entrega para o totem é um `.exe` Electron.
- **Por quê Electron e não só Chrome kiosk:** os requisitos de *gravar lead em disco* e *bloqueio total do SO* (visitante não pode sair pro Windows) são resolvidos nativamente pelo Electron via `fs`. Em navegador puro isso é frágil (download manual, IndexedDB, File System Access API com prompts).
- **Tema:** um `theme.json` por marca + pasta de assets. Zero código tocado para trocar personagem/pellets/cores.
- **Lead:** gravado como JSON-por-lead **e** consolidado em CSV, na pasta de dados do app. Exportável via pendrive ou cópia de rede.

---

## 1. Stack técnica

### Recomendação: Phaser (core agnóstico) + wrapper Electron kiosk

| Camada | Escolha | Papel |
|---|---|---|
| Lógica de jogo | TypeScript puro (`core/`) | Labirinto, regras, IA de perseguição, pontuação. Sem dependência de Phaser. |
| Render + input | Phaser 3 | Desenha o grid, sprites, animações, lê toque/swipe. |
| Build/dev | Vite | Hot reload, bundle estático. |
| Empacotamento | Electron + electron-builder | Single-exe, modo kiosk, acesso a disco para leads. |
| Persistência | `fs` (Electron) → JSON + CSV | Grava cada lead na hora; consolida CSV. |

### Por que Phaser e não Canvas puro

Você *poderia* fazer um Pac-Man em Canvas 2D cru — é um jogo de grid, a matemática é simples. Mas Phaser te dá de graça: gerenciamento de assets, sprite sheets/animação, loop de jogo, input de ponteiro (toque), cenas (attract → jogo → fim), e áudio. Para um jogo de estande que precisa ser **confiável e rápido de iterar**, reescrever tudo isso à mão é desperdício. O custo é ~1MB de lib. Vale.

Não use Three.js/Babylon (são 3D, overkill) nem engines pesadas tipo Unity (build gigante, licença, exagero para um maze 2D).

### Por que a lógica fica fora do Phaser (`core/`)

Regra de ouro: **o Phaser não deve "saber" as regras do jogo**. A IA dos fantasmas, a detecção de colisão no grid, a contagem de pontos — tudo isso é TypeScript puro testável com unit tests, sem subir um browser. O Phaser só lê o estado e desenha. Isso te dá:

- Testes unitários da IA de perseguição sem renderizar nada.
- Possibilidade de trocar Phaser por outra coisa no futuro sem reescrever o jogo.
- Bugs de regra isolados de bugs de render.

### Por que Electron e não só "Chrome em modo kiosk"

Foi a decisão mais disputada. Análise honesta:

**Chrome/Edge kiosk** (`--kiosk --app=...`): mais leve, zero build extra. **Mas:** gravar o lead em disco depende de download manual ou da File System Access API (que dispara prompts de permissão — inaceitável num totem desatravegado). E o lockdown não é total: combinações de tecla podem escapar pro Windows.

**Electron:** ~150MB de overhead e um build a mais. **Em troca:** `fs.writeFileSync` grava o lead na hora, sem prompt; `kiosk: true` + desabilitar atalhos trava o visitante dentro do app; single-exe que o time de evento só dá duplo-clique. Para os **seus** requisitos específicos (offline, multi-totem, lead em disco, lockdown), Electron paga o custo.

> **Estratégia prática:** desenvolva e teste no browser (Vite). O Electron é só a casca de produção. Se um dia quiser distribuir como kiosk de navegador, o mesmo build estático funciona — você não fica preso.

### Múltiplos terminais lado a lado

Cada totem roda uma instância independente e autocontida (sem internet, sem servidor central). Os leads são gravados localmente em cada máquina. A consolidação é **pós-evento**: você coleta os CSVs de cada totem (pendrive/rede) e junta. Cada arquivo de lead carrega um `terminalId` para você saber a origem. Não construa sincronização em rede — é complexidade que o caso de uso não pede.

---

## 2. Estrutura de pastas

```
pacman-gsb/
├─ package.json
├─ vite.config.ts
├─ electron-builder.yml
│
├─ src/
│  ├─ core/                 # LÓGICA DE JOGO — agnóstica de engine, testável
│  │  ├─ maze.ts            # representação do labirinto (grid, paredes, túneis)
│  │  ├─ player.ts          # movimento do personagem no grid
│  │  ├─ ghost-ai.ts        # IA de perseguição (chase/scatter/frightened)
│  │  ├─ pellets.ts         # estado dos pellets / power-pellets
│  │  ├─ scoring.ts         # pontuação, combos, vidas
│  │  ├─ game-state.ts      # máquina de estados (attract/playing/gameover)
│  │  └─ __tests__/         # unit tests da IA e regras
│  │
│  ├─ render/               # PONTE PHASER — só desenha e lê input
│  │  ├─ scenes/
│  │  │  ├─ AttractScene.ts # tela de chamariz "Toque para Jogar"
│  │  │  ├─ GameScene.ts     # renderiza o core, lê swipe/dpad
│  │  │  └─ LeadScene.ts     # pontuação final + captura de lead
│  │  ├─ input/
│  │  │  └─ touch-controls.ts # swipe + d-pad on-screen
│  │  └─ theme-loader.ts    # carrega theme.json e injeta nas cenas
│  │
│  ├─ theme/                # SISTEMA DE TEMA (lógica, não os assets)
│  │  ├─ theme-schema.ts    # tipos/validação do theme.json
│  │  └─ default-theme.ts   # fallback se um tema estiver incompleto
│  │
│  ├─ data/                 # PERSISTÊNCIA DE LEAD
│  │  ├─ lead-store.ts      # interface: salvar lead, listar, exportar CSV
│  │  └─ csv-export.ts      # serialização
│  │
│  └─ main.ts               # bootstrap do jogo
│
├─ shell/                   # ELECTRON (casca de produção)
│  ├─ main.js               # janela kiosk, fs, ipc
│  └─ preload.js            # ponte segura renderer↔fs
│
├─ themes/                  # ASSETS DE MARCA — fora do código, troca por pasta
│  ├─ gsb-default/
│  │  ├─ theme.json
│  │  ├─ player.png
│  │  ├─ pellet.png
│  │  ├─ power-pellet.png
│  │  ├─ ghosts/ (4 sprites)
│  │  ├─ logo.png
│  │  └─ sounds/
│  └─ cliente-exemplo/      # tema de um cliente específico do evento
│     └─ ... (mesma estrutura)
│
└─ leads/                   # SAÍDA — gravada em runtime, fora do bundle
   ├─ leads.csv             # consolidado
   └─ raw/                  # 1 JSON por lead (backup/auditoria)
```

### Princípio das fronteiras

Três coisas **nunca se misturam**, e essa separação é o coração do projeto:

1. **`core/` (regras)** não importa nada de `render/`. Não sabe o que é Phaser.
2. **`themes/` (marca)** é dado puro — imagens + um JSON. Designer mexe aqui sem abrir editor de código.
3. **`leads/` (dados do cliente final)** é saída de runtime, nunca versionada, nunca dentro do bundle.

Se alguém precisar tocar em duas dessas pastas pra fazer uma mudança, a fronteira foi violada.

---

## 3. Sistema de tema/skin

### `theme.json` — o manifesto

Tudo que muda entre marcas vive aqui. Trocar de tema = apontar o jogo para outra pasta. Zero recompilação.

```json
{
  "id": "gsb-default",
  "name": "Grupo Sudeste Banzai",
  "colors": {
    "maze": "#1b3a8f",
    "background": "#000010",
    "pelletGlow": "#ffcc00",
    "uiAccent": "#e30613",
    "textPrimary": "#ffffff"
  },
  "sprites": {
    "player": "player.png",
    "pellet": "pellet.png",
    "powerPellet": "power-pellet.png",
    "ghosts": ["ghosts/g1.png", "ghosts/g2.png", "ghosts/g3.png", "ghosts/g4.png"]
  },
  "audio": {
    "chomp": "sounds/chomp.mp3",
    "powerup": "sounds/powerup.mp3",
    "gameover": "sounds/gameover.mp3"
  },
  "branding": {
    "logo": "logo.png",
    "attractHeadline": "DESVIE. COLETE. VENÇA.",
    "ctaButton": "TOCAR PARA JOGAR",
    "leadHeadline": "Cadastre-se e concorra a um brinde!"
  },
  "leadForm": {
    "fields": [
      { "id": "name",     "label": "Nome",      "type": "text",   "required": true,  "maxLength": 60 },
      { "id": "email",    "label": "E-mail",    "type": "email",  "required": true },
      { "id": "phone",    "label": "Telefone",  "type": "tel",    "required": false },
      { "id": "company",  "label": "Empresa",   "type": "text",   "required": false, "maxLength": 80 },
      {
        "id": "interest", "label": "Interesse", "type": "select", "required": false,
        "options": ["Veículos novos", "Seminovos", "Consórcio", "Pós-venda"]
      },
      { "id": "consent",  "label": "Aceito receber contato", "type": "checkbox", "required": false }
    ]
  },
  "gameplay": {
    "playerSpeed": 1.0,
    "ghostSpeed": 0.9,
    "powerDurationMs": 6000
  }
}
```

### Campos de lead personalizáveis

O bloco `leadForm.fields` define **quais campos** o totem coleta — por marca, sem tocar código. Cada campo:

| Chave | Papel |
|---|---|
| `id` | Chave do dado no lead salvo (vira coluna do CSV). Único, sem espaços. |
| `label` | Texto exibido no formulário e cabeçalho do CSV. |
| `type` | `text` \| `email` \| `tel` \| `select` \| `checkbox`. Define teclado on-screen e validação. |
| `required` | Bloqueia o envio se vazio. |
| `maxLength` | (opcional) limite para `text`. |
| `options` | (obrigatório p/ `select`) lista de opções. |

Regras do contrato:

- **`default-theme.ts` garante o mínimo:** se `leadForm` faltar ou vier vazio, cai no par `name` + `email` (os dois únicos campos que o negócio sempre exige).
- **`data/lead-store.ts` é agnóstico de schema** — salva um mapa `id → valor` mais os metadados fixos (`terminalId`, `timestamp`, `score`). Adicionar um campo no `theme.json` **não exige mudança no código de persistência**; o CSV ganha a coluna nova automaticamente, com união de colunas entre leads de schemas diferentes.
- **UX manda:** cada campo a mais derruba a taxa de captura (seção 4). O default segue mínimo de propósito; campos extras são decisão consciente do cliente, não padrão.
- **Validação por `type`** é leve (e-mail com regex simples, `tel` só dígitos/máscara). `consent` como `checkbox` cobre opt-in de contato — o consentimento LGPD em si é presencial.

### Como funciona o carregamento

1. No boot, `theme-loader.ts` lê o `theme.json` da pasta de tema ativa (definida por config/variável de ambiente).
2. `theme-schema.ts` valida o JSON. Campo faltando → cai no `default-theme.ts` (o jogo nunca quebra por tema incompleto).
3. As cores entram como tokens nas cenas; os sprites são pré-carregados pelo loader do Phaser; os textos de branding alimentam attract e lead.
4. **O `core/` recebe só `gameplay` (números).** Sprites e cores nunca chegam à lógica — ela não precisa saber a cor de nada.

### O contrato

Um designer entrega uma pasta com PNGs nos tamanhos certos + um `theme.json` preenchido. Solta em `themes/`. Aponta o jogo. Pronto. **Nenhum desenvolvedor envolvido para um novo cliente.** Esse é o objetivo de negócio do sistema de tema — documente os tamanhos exatos de sprite (ex: 64×64) num `themes/README.md` para o designer.

---

## 4. UX — o que funciona em totem (e o que evitar)

Pesquisei referências de kiosks de feira. O resumo aplicado ao seu caso:

### Fluxo de telas

```
[ATTRACT] → toque → [JOGO] → fim → [LEAD] → confirma → [ATTRACT]
   ↑ loop de demo / chamariz                          ↓ reset por inatividade
```

### O que fazer

- **Attract mode obrigatório.** Tela que se mexe sozinha com "TOQUE PARA JOGAR" pulsando. Sem isso, ninguém sabe que o totem é interativo — é a regra nº 1 de kiosk.
- **Sessão curta.** Se leva >1 min pra explicar ou >5 min pra terminar, a pessoa desiste. Rodadas de 60–90s. Uma vida ou tempo limitado, não três fases.
- **Alvos de toque grandes.** Mínimo teórico é 44×44px, mas em totem (pessoa em pé, a meio metro) use **bem maior** — botões de 80–120px, fonte grande. Espaçamento ≥10px entre alvos.
- **Controle por swipe** como principal (deslizar na direção do movimento), com **d-pad on-screen grande** como reforço. Pac-Man é direcional — swipe é natural no toque.
- **Formulário de lead minúsculo por padrão.** Default = nome + e-mail. Campos extras são **configuráveis por marca** no `leadForm.fields` do `theme.json` (telefone, empresa, interesse, opt-in), mas cada campo a mais derruba a taxa de captura — adicione com parcimônia. Teclado on-screen grande, validação leve, botão "ENVIAR" enorme.
- **Reset por inatividade.** Sem toque por ~30s em qualquer tela → volta pro attract. Totem nunca pode ficar "preso" numa tela morta.
- **Leaderboard** (opcional, mas converte). Cria competição e faz a pessoa voltar/chamar colega. Pode ser local, do dia.

### O que evitar

- **Nada de teclado físico** assumido — tudo no toque.
- **Sem dead-ends visuais:** nenhuma tela que pareça quebrada ou estática sem indicar o que fazer.
- **Não use tilt/giroscópio** — totem não se inclina, e tablet em pedestal também não.
- **Não enterre o lead atrás do jogo perfeito.** Capture o lead **mesmo se a pessoa perder logo**. A pontuação é isca; o lead é o produto.
- **Sem textos pequenos / jargão.** "TOCAR PARA JOGAR", não "Inicializar sessão de gameplay".
- **Não dependa de áudio** para informação crítica — feira é barulhenta. Áudio é tempero, não canal.

---

## Plano de módulos (ordem para levar ao Code)

1. **`core/maze` + `core/player`** — grid, movimento, colisão de parede. Testável sem render.
2. **`core/ghost-ai`** — chase/scatter/frightened. O coração técnico; faça com unit tests.
3. **`core/scoring` + `core/game-state`** — pontos, vidas, máquina de estados.
4. **`render/GameScene`** — plugar Phaser no core: desenhar grid + sprites, ler input.
5. **`render/input/touch-controls`** — swipe + d-pad.
6. **`theme/` + `render/theme-loader`** — manifesto, validação, fallback. Testar com 2 temas.
7. **`render/AttractScene`** — chamariz + reset por inatividade.
8. **`render/LeadScene` + `data/lead-store`** — pontuação final, formulário **gerado dinamicamente a partir de `leadForm.fields`**, validação por tipo, gravação com schema agnóstico (CSV de colunas unidas).
9. **`shell/` (Electron)** — janela kiosk, `fs`, export CSV. Só no fim.
10. **Verificação** — testar 2 temas distintos, ciclo completo de inatividade, gravação de lead, e o .exe em uma máquina limpa offline.

### Decisões que deixei tomadas (assunções — me corrija se divergir)

- **Electron como produção, browser como dev.** Se você preferir simplicidade absoluta e topar gerenciar export de lead manualmente, dá pra ficar só em Chrome kiosk — mas perde a gravação automática em disco.
- **Sem rede entre totens.** Consolidação de leads é manual, pós-evento.
- **Phaser 3, não 4.** Mais maduro e documentado hoje; migrar depois é viável já que o `core/` é agnóstico.
- **TypeScript.** Para a IA dos fantasmas e o schema de tema, tipos evitam uma classe inteira de bugs. Se o time só topa JS, funciona, mas recomendo TS.

---

### Fontes
- [Phaser (game framework) — Wikipedia](https://en.wikipedia.org/wiki/Phaser_(game_framework))
- [Phaser 4 Tutorial 2026 — tech-insider.org](https://tech-insider.org/phaser-4-tutorial-browser-game-12-steps-2026/)
- [JS game rendering benchmark — GitHub](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [Procedural Maze Generation in Phaser 3](https://phaser.io/news/2019/02/procedural-maze-generation-in-phaser-3)
- [Touch Screen Kiosk Guide — Look Digital Signage](https://www.lookdigitalsignage.com/blog/touch-screen-kiosk-guide)
- [How Interactive Games Turn Your Booth into a Lead-Generating Machine — PandaSuite](https://pandasuite.com/blog/interactive-trade-show-booth-games/)
- [Interactive Touchscreen Games for Trade Shows — Peek & Poke](https://peekandpoke.com/touchscreen-games/)
