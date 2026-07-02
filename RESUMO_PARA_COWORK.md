# Kiosk Maze — Resumo do Projeto (para novo chat)

## O que é

Jogo de labirinto estilo Pac-Man para **totem/tablet em eventos corporativos** do
Grupo Sudeste Banzai (GSB). A pontuação é isca; **o lead capturado (nome/e-mail)
é o produto real**. Roda offline, sem servidor central.

Repositório: https://github.com/Paszmani/maze-game (branch `main`, sincronizado e
até a data desta nota tudo commitado/enviado — confirme `git status` ao retomar).

## Stack e arquitetura

- **TypeScript + Vite + Phaser 3** para o jogo (renderer).
- **`src/core/`** — toda a lógica de jogo é agnóstica de engine, testada sem
  abrir browser (labirinto, movimento, IA dos 4 fantasmas tipo Pac-Man clássico,
  pontuação, máquina de estados, fruta bônus, ghost house). Phaser só lê esse
  estado e desenha. **Mantenha essa separação em qualquer mudança futura.**
- **Sistema de tema** (`src/theme/` + `theme.json` por marca): cores, sprites
  (player/fantasmas/fruta/fundos via PNG ou data-URI), textos, estilo da tela de
  abertura (Attract) e campos do formulário de lead — tudo trocável sem mexer em
  código.
- **Editor de tema visual** (`editor.html`, acessível por um botão "⚙
  Personalizar" na tela inicial do jogo): formulário com prévia ao vivo (iframe
  rodando a engine real), responsivo (empilha em mobile ≤760px).
- **Cross-platform, mesmo `dist/web`:**
  - **Windows** via **Electron** (`shell/main.cjs` + `preload.cjs`) — kiosk
    fullscreen com lockdown, grava lead em disco (JSON + CSV via `fs`).
  - **Android** via **Capacitor** (`android/`, `src/platform/capacitor-kiosk.ts`)
    — mesmo bundle web, ponte equivalente via `@capacitor/filesystem`,
    `MainActivity.java` com Lock Task (screen pinning) + tela cheia.
  - Ambas implementam a interface `KioskBridge` (`src/shell/bridge.ts`) exposta
    em `window.kiosk` — o jogo não sabe em qual plataforma está.
- **107 testes unitários** (Vitest) cobrindo `core/` e `theme/`. `npm run
  typecheck` e `npm run build` também devem passar limpo sempre.

## Estrutura de pastas relevante

```
src/
  core/             lógica de jogo pura (maze, player, ghost-ai, scoring, game-state)
  render/           cenas Phaser (Attract, Game, Lead, Preload), input touch, tema
  theme/            schema + resolução de theme.json
  data/             lead-store (localStorage/disco) + csv-export
  shell/            tipos da ponte nativa (bridge.ts)
  platform/         implementação Capacitor da ponte (capacitor-kiosk.ts)
  editor/           lógica do editor visual de tema
shell/              Electron: main.cjs, preload.cjs, README.md
android/            projeto Capacitor/Android gerado (+ README-kiosk.md)
public/themes/      temas de exemplo (gsb-default, cliente-exemplo)
editor.html         página do editor de tema
index.html          página do jogo
```

## Comandos principais

```bash
npm run dev              # web, http://localhost:5173 (editor em /editor.html)
npm test                 # 107 testes
npm run typecheck
npm run build             # gera dist/

npm run electron          # roda o jogo na janela kiosk do Electron (Windows)
npm run dist               # gera o .exe (release/)

npm run android:sync       # build + sincroniza pro projeto Android
npm run android:open       # abre no Android Studio
```

## Histórico desta sessão (mais recente primeiro)

1. **5 melhorias de gameplay/UX implementadas**, um commit por área (ver
   `git log` para detalhes/hashes exatos):
   - **Ghost house**: liberação escalonada por contador de dots (Blinky/Pinky
     saem direto; Inky aos 30 dots; Clyde aos 60), com fallback de tempo
     anti-trava. Olhos comidos voltam e são re-liberados. *Pendência visual: a
     caixa física da casa no labirinto ainda não foi desenhada — só a mecânica
     de liberação está pronta.*
   - **IA dos fantasmas**: o modelo scatter/chase + target-tile já existia;
     adicionado Cruise Elroy (Blinky acelera com poucos dots) e velocidade
     reduzida no túnel.
   - **Fruta bônus**: aparece em 70/170 dots, dura ~9.5s, pontos configuráveis,
     popup de pontuação flutuante (também ao comer fantasma). Sprite
     customizável via tema.
   - **Movimento suave**: interpolação visual entre células de grid (lógica
     continua discreta no core; render faz lerp). Pac-Man com boca animada,
     power-pellet piscando, flash do frightened, bob da casa.
   - **UI responsiva**: formulário de lead em card fluido com alvos de toque
     adequados; editor empilha em 1 coluna no mobile.
   - **Não verificado nesta sessão**: jogo em sessão prolongada real (chase,
     fruta sendo comida, interpolação em movimento contínuo) e o visual da
     Área 5 — o viewport do preview do ambiente ficou instável (0×0)
     intermitentemente ao longo da sessão, atrapalhando screenshots. Rode
     `npm run dev` e jogue manualmente para validar.

2. **Cross-platform (Electron + Capacitor) implementado** a pedido do usuário,
   reusando a mesma ponte `window.kiosk` nas duas plataformas.

3. **Bug corrigido**: Electron abria em tela branca porque o Vite gerava
   `/assets/...` absoluto (não resolve sob `file://`). Corrigido com `base:
   './'` no `vite.config.ts` — essencial manter essa config intacta.

4. **Git**: o histórico continha binários do Electron (>100MB) que bloqueavam o
   push pro GitHub; foi limpo via `git filter-branch` (não repetir — só
   relevante se o problema reaparecer). Repo sincronizado com
   `Paszmani/maze-game`.

## Pontos em aberto / próximos passos sugeridos

- **Lockdown Android é parcial**: hoje é "fixação de tela" (Lock Task sem
  device-owner), escapável segurando Voltar+Recentes. Kiosk total exigiria
  configurar o app como device-owner via ADB + adicionar um
  `DeviceAdminReceiver` — ainda não implementado.
- **Caixa física da ghost house** no labirinto (visual) — a mecânica de
  liberação já funciona, falta desenhar a estrutura no maze.
- **Object pooling / sprite atlas** — otimização de performance mencionada no
  prompt original, ainda não feita (micro-otimização, não bloqueante).
- **`.exe`/APK nunca testados literalmente abrindo** neste ambiente (sem
  display gráfico / Android SDK) — validar fisicamente na máquina do usuário.
- Áudio e leaderboard local seguem como possíveis melhorias futuras, ainda não
  pedidas formalmente.

## Convenções importantes para quem continuar

- **Nunca misture lógica de jogo no `render/`** — regras vão em `core/`, com
  teste. O Phaser só lê estado e desenha.
- Rodar `npm test && npm run typecheck && npm run build` ao final de qualquer
  mudança.
- Commits separados por funcionalidade/área, mensagens claras.
- `theme.json` deve manter retrocompatibilidade com os temas existentes
  (`gsb-default`, `cliente-exemplo`) — todo campo novo no schema precisa de
  fallback.
