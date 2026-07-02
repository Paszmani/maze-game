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
npm run android:sync     # vite build + copia o dist/ pro android + sincroniza plugins
npm run android:open     # abre no Android Studio  ->  Run, ou Build > Build APK(s)
```

Ou por linha de comando (com SDK configurado):

```
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug      # APK em app/build/outputs/apk/debug/
```

Instale o APK no aparelho (`adb install` ou copiando o arquivo).

Depois de adicionar o plugin `@capacitor/share` (usado no botão de extrair leads
abaixo), rode `npm run android:sync` de novo antes de reabrir o Android Studio —
é o que registra o plugin nativo no projeto.

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
