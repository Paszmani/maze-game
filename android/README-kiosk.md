# Totem Android (Capacitor)

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

## Onde ficam os dados (no aparelho)

`Directory.External` → `/Android/data/com.gsb.kioskmaze/files/`:

```
config.json              { "themeId": "...", "terminalId": "..." }
themes/<id>/theme.json   tema(s) (o editor salva aqui via "Salvar no totem")
leads/leads.csv          consolidado
leads/raw/<...>.json      1 por lead
```

Acessível por USB / gerenciador de arquivos para o operador copiar os leads.
Crie o `config.json` aí (ou deixe o padrão: tema `gsb-default`, terminal `totem-01`).

## Lockdown (dois níveis)

**1. Fixação de tela (já funciona, sem configuração).**
A `MainActivity` chama `startLockTask()` + tela cheia imersiva + tela sempre
ligada. Trava o app, mas é escapável segurando **Voltar + Recentes**. Suficiente
para estande supervisionado.

**2. Kiosk total (device-owner — opcional, avançado).**
Para travar de verdade (sem escapar), o app precisa ser *device owner* num
aparelho recém-resetado (sem conta Google):

```
adb shell dpm set-device-owner com.gsb.kioskmaze/.AdminReceiver
```

Isso exige um `DeviceAdminReceiver` no app (ainda não incluído). Se quiser esse
nível, me peça que eu adiciono o receiver + o XML de admin.

> Lembrete: o botão **⚙ Personalizar** na tela inicial abre o editor de tema. No
> totem isso fica visível para qualquer um — dá para esconder atrás de um gesto se
> preferir acesso só do operador.
