# Maze Game (GSB)

Jogo de labirinto para totem/tablet em eventos — captura de lead (nome/e-mail)
com a pontuação como isca. Core TypeScript agnóstico de engine + Phaser 3 no
render; totalmente customizável pelo operador via editor de tema (sem código).

| Plataforma | Saída | Comando |
|---|---|---|
| Web (dev) | Vite em `localhost:5173` | `npm run dev` |
| **Windows** | `.exe` (Electron) | `npm run dist` |
| **Android** | APK (Capacitor) | `npm run android:apk` |

## Comandos

```bash
npm install          # uma vez
npm run dev          # dev server — jogo em / e editor em /editor.html
npm test             # 127 testes (Vitest)
npm run typecheck    # TypeScript estrito
npm run build        # typecheck + produção (dist/)
```

## Build Windows (Electron)

```bash
npm run build && npm run electron   # roda local, janela normal
npm run dist                        # gera release/win-unpacked/ + .zip
```

Sem assinatura de código (app interno) — o electron-builder usa alvo `dir`+`zip`
para dispensar o winCodeSign. O ícone vem de `build/icon.png`.
Ao lado do exe: `config.json` (tema/terminal), `themes/` (temas externos,
prioridade sobre o bundle) e `data/leads/` (CSV consolidado + 1 JSON por lead).

## Build Android (APK)

```bash
npm run android:sync   # typecheck + vite build + cap sync android
npm run android:open   # abre no Android Studio -> Run, ou Build > Build APK(s)
npm run android:apk    # APK direto por linha de comando (sem abrir o Studio)
```

O `android:apk` acha sozinho um JDK 17–21 (prefere o JBR do Android Studio;
override: `JAVA_HOME_ANDROID`) e roda `assembleDebug` — o APK sai **assinado
com a keystore de debug** e instala direto no aparelho:
`android/app/build/outputs/apk/debug/app-debug.apk`.
(O buildType `release` do template Capacitor não tem assinatura configurada —
por isso o padrão aqui é o debug, suficiente para totem/distribuição direta.)

O primeiro build baixa o Gradle e as dependências (demora); os seguintes usam
os caches (`org.gradle.caching`/`parallel` já ligados em
`android/gradle.properties`). Detalhes de operação no aparelho (tema, leads,
pastas): [android/README-kiosk.md](android/README-kiosk.md).

## Editor de tema (operador)

`/editor.html` (ou botão ⚙ na tela inicial): identidade, cores, sprites por
imagem, textos, tela de descanso, gameplay e campos do formulário de lead.
"Testar jogo" abre o jogo real com o rascunho; "Aplicar e voltar" persiste
(web: localStorage; totem: disco). "Exportar tema" baixa o `theme.json` no
desktop e abre a folha de compartilhamento no Android; "Importar" lê o JSON
em qualquer plataforma.

## Leads

CSV pt-BR padronizado dos três jogos (separador `;`, BOM UTF-8, data/hora
locais, cabeçalhos em português). Extração: botão 📂 Leads no editor
(Windows: abre a pasta; Android: folha de compartilhamento) ou por USB em
`/Android/data/com.gsb.kioskmaze/files/leads/` — ver [docs/LEADS.md](docs/LEADS.md).

## Documentação

- [ARQUITETURA.md](ARQUITETURA.md) — decisões de stack e fronteiras do código.
- [android/README-kiosk.md](android/README-kiosk.md) — operação no Android.
- [shell/README.md](shell/README.md) — operação no Windows (Electron).
