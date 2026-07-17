# Maze Game — Android (Capacitor)

O mesmo jogo web (`dist/`) empacotado num APK offline. O totem Windows continua
no Electron; os dois compartilham o `dist/`. A ponte nativa (`window.kiosk`) é
populada pelo Capacitor no Android (ver `src/platform/capacitor-kiosk.ts`), então
tema e leads funcionam igual ao Electron — só que via Filesystem do Android.

## Pré-requisitos (na máquina de build)

- Android Studio + JDK 17 + Android SDK.
- Node já instalado (o projeto já tem o Capacitor).

## Build / rodar

```
npm run android:sync     # typecheck + vite build + copia o dist/ pro android + sincroniza plugins
npm run android:open     # abre no Android Studio  ->  Run, ou Build > Build APK(s)
npm run android:apk      # gera o APK direto por linha de comando (sem abrir o Studio)
```

O `android:apk` (padrão comum aos três jogos, `scripts/build-android.cjs`) acha
sozinho um JDK 17–21 (prefere o JBR do Android Studio) e roda o Gradle
`assembleDebug` — APK assinado com a keystore local em
`android/app/build/outputs/apk/debug/app-debug.apk`, pronto para instalar
(`adb install` ou copiando o arquivo).

Depois de adicionar qualquer plugin `@capacitor/*` novo, rode `npm run
android:sync` de novo antes de reabrir o Android Studio — é o que registra o
plugin nativo no projeto.

## Exportar / importar tema no Android

No editor (⚙ Personalizar), **Exportar tema** abre a folha nativa de
compartilhamento com o `<id>.json` (e-mail/Drive/WhatsApp — âncora de download
não funciona no WebView). **Importar** usa o seletor de arquivos do sistema
normalmente. O tema aplicado fica gravado em disco
(`themes/<id>/theme.json` + `config.json`), então sobrevive a reaberturas.

## Extrair o CSV de leads

**Pelo app (recomendado):** na tela inicial, ⚙ **Personalizar** → botão **📂
Leads** no topo do editor. Abre a folha nativa de compartilhamento do Android com
o `leads.csv` — mande por e-mail, Drive, WhatsApp etc. direto do tablet. Se ainda
não houver nenhum lead salvo, o botão avisa.

**Por USB / gerenciador de arquivos (alternativa manual):**
`Directory.External` → `/Android/data/com.gsb.kioskmaze/files/`:

```
config.json              { "themeId": "...", "terminalId": "..." }
themes/<id>/theme.json   tema(s) (o editor salva aqui via "Salvar no totem")
leads/leads.csv          consolidado
leads/raw/<...>.json      1 por lead
```

Crie o `config.json` aí (ou deixe o padrão: tema `gsb-default`, terminal `totem-01`).

## Sem lockdown

O app roda em tela cheia imersiva e mantém a tela ligada, mas **não trava** o
usuário nele — dá para sair normalmente (Home/Recentes). Se precisar de kiosk de
verdade no futuro (screen pinning ou device-owner), me avise que eu reintroduzo.

> Lembrete: o botão **⚙ Personalizar** na tela inicial abre o editor de tema. Fica
> visível para qualquer um — dá para esconder atrás de um gesto se preferir acesso
> só do operador.
