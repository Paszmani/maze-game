# Casca Electron (totem) — operação

A casca de produção: transforma o jogo web num `.exe` de tela cheia com lockdown e
gravação de lead em disco. Em dev, o jogo roda no browser (`npm run dev`); a casca
é só a entrega final.

## Rodar a casca em dev

```
npm run build                 # gera o dist/
npm run electron              # abre a janela kiosk carregando o dist/
```

Para apontar a casca ao Vite (hot reload) em vez do dist:

```
# terminal 1
npm run dev
# terminal 2  (PowerShell)
$env:KIOSK_DEV_URL = "http://localhost:5173"; npm run electron
```

## Gerar o app

```
npm run dist                  # vite build + electron-builder
```

Saída em `release/`:

- **`release/win-unpacked/`** — pasta com `KioskMaze.exe` e os recursos. **É o app.**
  Copie a pasta inteira para o totem e dê duplo-clique no `KioskMaze.exe`.
- **`release/KioskMaze-<versão>.zip`** — a mesma pasta zipada, para transporte.

> Por que não um `.exe` único (portable)? No Windows sem admin, o alvo `portable`/`nsis`
> falha ao extrair o `winCodeSign` (precisa de privilégio para criar symlink). Usamos
> `dir` + `zip`, que não precisam dele. Se quiser o portable single-file, ative o
> **Modo Desenvolvedor** do Windows (Configurações › Para desenvolvedores) e troque o
> alvo no `electron-builder.yml` para `portable`.
>
> O exe usa o **ícone padrão do Electron** (não editamos o binário, justamente para não
> depender do winCodeSign). Para um ícone próprio, ative o Modo Desenvolvedor e ponha
> `signAndEditExecutable: true` + `icon:` no `electron-builder.yml`.

## Layout ao lado do .exe (produção)

```
KioskMaze.exe
config.json          { "themeId": "...", "terminalId": "..." }   (ver config.example.json)
themes/<id>/...      temas externos (opcional; troca sem rebuild — o main prioriza esta pasta)
data/leads/          SAÍDA, criada em runtime:
  ├─ leads.csv       consolidado (colunas unidas entre leads/temas)
  └─ raw/            1 JSON por lead (backup/auditoria)
```

- **`config.json`** define qual tema e qual `terminalId` esta máquina usa. Cada lead
  carrega o `terminalId`, então na consolidação pós-evento você sabe a origem.
- **Temas**: se houver `themes/` ao lado do exe, ela vence; senão usa o bundle
  (`dist/themes`). As imagens são lidas do disco e embutidas como data-URI no boot.
- **Leads**: gravados na hora em `data/leads/`. Exporte por pendrive copiando essa
  pasta. O CSV é regenerado a cada lead (une colunas de schemas diferentes).

## Lockdown

- Tela cheia + `kiosk`, sem moldura, sem menu.
- Atalhos de fuga bloqueados (F5/F11/F12, Ctrl+R/W/N/T/P, DevTools, zoom).
- Janela não fecha; `window.open` negado.
- **Saída de admin: `Ctrl+Shift+Q`.**

> Lockdown total do SO (Alt+Tab, Win, Ctrl+Alt+Del) exige política do Windows
> (modo quiosque atribuído / shell substituto). A casca cobre a camada do app.
