# Temas — guia do designer

Cada marca é uma pasta aqui dentro com um `theme.json`. Para um novo cliente:
**copie uma pasta existente, troque os valores, aponte o jogo** com `?theme=<id>`
na URL (ex.: `?theme=cliente-exemplo`). **Nenhum desenvolvedor envolvido.**

Se um campo faltar ou vier errado, o jogo cai no valor padrão — ele nunca quebra
por tema incompleto. Mas capriche: o tema é a cara da marca no evento.

## Estrutura de uma pasta de tema

```
public/themes/<id>/
├─ theme.json     (obrigatório)
├─ logo.png       (opcional, branding)
└─ ... sprites/sons (opcional — ver tamanhos abaixo)
```

## Campos do theme.json

| Bloco | Campo | O que é |
|---|---|---|
| `colors` | `maze`, `background`, `pellet`, `power`, `player`, `frightened`, `eaten`, `uiAccent` | Cores em hex `#rrggbb`. |
| `colors` | `text` | Cor do texto (hex). |
| `colors` | `ghosts` | Lista de 4 cores hex, na ordem dos 4 fantasmas. |
| `branding` | `attractHeadline`, `ctaButton`, `leadHeadline` | Textos das telas. Maiúsculas, curtos. |
| `branding` | `logo` | Nome do arquivo do logo (opcional). |
| `gameplay` | `playerSpeed`, `ghostSpeed` | Velocidades relativas (1.0 = base). |
| `gameplay` | `powerDurationMs` | Duração do modo "frightened" em ms. |
| `leadForm` | `fields` | Campos do formulário de lead (ver abaixo). |

## Campos de lead (`leadForm.fields`)

Cada campo: `id` (chave/coluna do CSV, sem espaços), `label` (texto exibido),
`type` (`text` \| `email` \| `tel` \| `select` \| `checkbox`), `required` (bool).
Opcionais: `maxLength` (para `text`), `options` (lista, obrigatória para `select`).

> Cada campo a mais derruba a taxa de captura. O padrão é mínimo (nome + e-mail);
> adicione extras só quando a marca realmente precisar.

## Tamanhos de sprite (quando houver arte)

Por ora o jogo desenha formas; ao adicionar arte, use **PNG com fundo transparente**:

| Sprite | Tamanho |
|---|---|
| `player` | 64×64 |
| `pellet` | 16×16 |
| `power-pellet` | 32×32 |
| cada fantasma | 64×64 |
| `logo` | livre (altura ~120px recomendada) |
