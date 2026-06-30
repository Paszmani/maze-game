# Kiosk Maze — Resumo do Projeto (para Cowork)

## O que é

Jogo de labirinto estilo Pac-Man para **totem/tablet em eventos corporativos** do
Grupo Sudeste Banzai (GSB). A pontuação é isca; **o lead capturado (nome/e-mail)
é o produto real**. Roda offline, sem servidor central.

Repositório: https://github.com/Paszmani/maze-game (branch `main`, sincronizado).

## Stack e arquitetura

- **TypeScript + Vite + Phaser 3** para o jogo (renderer).
- **`src/core/`** — toda a lógica de jogo é agnóstica de engine, testada sem
  abrir browser (labirinto, movimento, IA dos 4 fantasmas tipo Pac-Man clássico,
  pontuação, máquina de estados). Phaser só lê esse estado e desenha.
- **Sistema de tema** (`src/theme/` + `theme.json` por marca): cores, sprites
  (imagens customizáveis de player/fantasmas/fundos via PNG ou data-URI), textos,
  estilo da tela de abertura (Attract) e campos do formulário de lead — tudo
  trocável **sem mexer em código**, só apontando pra outra pasta/arquivo.
- **Editor de tema visual** (`editor.html`, acessível por um botão "⚙
  Personalizar" na tela inicial do jogo): formulário com prévia ao vivo (iframe
  rodando a engine real) para montar o `theme.json` sem editar JSON à mão —
  upload de imagens, cores, textos, campos de lead, etc.
- **Cross-platform, mesmo `dist/web`:**
  - **Windows** via **Electron** (`shell/main.cjs` + `preload.cjs`) — kiosk
    fullscreen com lockdown de atalhos, grava lead em disco (JSON por lead + CSV
    consolidado via `fs`), lê/escreve tema em disco.
  - **Android** via **Capacitor** (`android/`, `src/platform/capacitor-kiosk.ts`)
    — mesmo bundle web, ponte equivalente usando `@capacitor/filesystem`,
    `MainActivity.java` com Lock Task (screen pinning) + tela cheia imersiva.
  - Ambas as plataformas implementam a mesma interface `KioskBridge`
    (`src/shell/bridge.ts`) exposta em `window.kiosk` — o jogo não sabe em qual
    plataforma está rodando.
- **93 testes unitários** (Vitest) cobrindo `core/` e `theme/` — passam limpo.

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
npm test                 # 93 testes
npm run typecheck
npm run build             # gera dist/

npm run electron          # roda o jogo na janela kiosk do Electron (Windows)
npm run dist               # gera o .exe (release/)

npm run android:sync       # build + sincroniza pro projeto Android
npm run android:open       # abre no Android Studio
```

## Estado atual / pontos em aberto

- **Tudo commitado e no GitHub.** Histórico já foi limpo de binários grandes que
  bloqueavam o push (release/ do Electron, >100MB — removido do histórico via
  `git filter-branch`; `.gitignore` já cobre `release/`, `dist/`, `node_modules/`).
- **Bug corrigido recentemente:** Vite precisava de `base: './'` no
  `vite.config.ts` — sem isso, o Electron abria em **tela branca** porque os
  assets eram referenciados com caminho absoluto (`/assets/...`), que não resolve
  sob `file://`. Já corrigido e testado no modo web; **ainda não testado
  literalmente abrindo o `.exe`/APK** (ambiente de desenvolvimento sem display
  gráfico/Android SDK para validar isso).
- **Lockdown Android é parcial:** hoje é "fixação de tela" (Lock Task sem
  device-owner), escapável segurando Voltar+Recentes. Kiosk total exigiria
  configurar o app como device-owner via ADB + adicionar um
  `DeviceAdminReceiver` — ainda não implementado.
- Faltam pulir: interpolação suave de movimento (hoje é "snapping" célula a
  célula), áudio, possível leaderboard local.

## O que pedimos para o Cowork

(usuário vai colar as funções/tarefas específicas a seguir)
