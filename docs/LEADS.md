# Como extrair o CSV de leads

Cada cadastro preenchido no fim do jogo grava um lead. O jogo mantém um **CSV
consolidado** (`leads.csv`) que junta as colunas de todos os cadastros, além de um
JSON por lead em `raw/`.

Colunas do CSV: `timestamp, terminalId, themeId, score` + um campo por pergunta do
formulário (ex.: `name`, `email`, `phone`).

---

## Botão "📂 Leads" no editor (mais rápido, nas duas plataformas)

Na tela inicial do jogo, abra ⚙ **Personalizar** — o topo do editor tem um botão
**📂 Leads** (só aparece rodando no Electron ou no Android, não no navegador).

- **Electron:** abre a pasta `data/leads/` direto no Explorador do Windows.
- **Android:** abre a folha nativa de compartilhamento com o `leads.csv` — mande
  por e-mail, Google Drive, WhatsApp etc. direto do tablet/totem, sem precisar
  de cabo ou computador por perto.

Se ainda não houver nenhum cadastro salvo, o botão avisa em vez de abrir vazio.

---

## Desktop (Electron / `.exe`) — caminho manual

Os leads ficam em disco, **ao lado do `.exe`**, na pasta:

```
<pasta do Maze Game.exe>/data/leads/leads.csv
```

Passo a passo:

1. Abra a pasta onde está o `Maze Game.exe` (ex.: `release/win-unpacked/`).
2. Entre em `data/leads/`.
3. Copie o `leads.csv` (abre direto no Excel / Google Sheets).
   - Os arquivos individuais ficam em `data/leads/raw/` (1 JSON por lead), caso
     precise reprocessar.

> Em desenvolvimento (`npm run electron`, sem empacotar), a pasta `data/leads/`
> é criada na **raiz do projeto**.

---

## Android (APK) — caminho manual

Os leads ficam no armazenamento **externo do app** (acessível por USB / gerenciador
de arquivos), na pasta:

```
Android/data/com.gsb.kioskmaze/files/leads/leads.csv
```

Passo a passo:

1. Conecte o tablet/celular ao PC por USB e autorize a transferência de arquivos
   (MTP), **ou** use um app de arquivos no próprio aparelho (ex.: "Files"/"Meus
   Arquivos").
2. Navegue até `Android/data/com.gsb.kioskmaze/files/leads/`.
3. Copie o `leads.csv`.
   - Individuais em `.../leads/raw/`.

> `com.gsb.kioskmaze` é o **appId** (não muda ao renomear o app para "Maze Game").
> Em Android recentes, a pasta `Android/data/...` pode exigir o gerenciador de
> arquivos do próprio sistema ou a conexão USB (MTP) para ser acessada.
