# Ícone do app (Maze Game)

O ícone **não** é embutido no código — cada plataforma lê um arquivo de imagem.
Coloque a logo do app conforme abaixo (uma imagem quadrada, fundo transparente,
recomendado **1024×1024 PNG**).

## Desktop (Electron)

1. Salve a logo como `build/icon.png` (mínimo 512×512; ideal 1024×1024).
   - O electron-builder usa a pasta `build/` como *buildResources* e detecta o
     `icon.png` automaticamente — nenhuma outra config é necessária.
2. Gere o instalável: `npm run dist`.

> Opcional (ícone da janela em dev, além do instalável): dá para apontar
> `win.setIcon(...)` no `shell/main.cjs`, mas para o `.exe` final basta o
> `build/icon.png`.

## Android

O jeito mais simples é gerar todos os tamanhos (mipmaps) a partir de uma imagem:

```bash
npm i -D @capacitor/assets
# coloque a logo em: resources/icon.png  (1024x1024)
npx @capacitor/assets generate --android
npm run android:sync
```

Isso substitui os `res/mipmap-*/ic_launcher*.png` do projeto Android.

**Alternativa (Android Studio):** `npm run android:open` → clique com o botão
direito em `app/res` → *New → Image Asset* → escolha a logo → *Finish*.

> O nome exibido no launcher ("Maze Game") vem de
> `android/app/src/main/res/values/strings.xml` (`app_name`), já ajustado.
