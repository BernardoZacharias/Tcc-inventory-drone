# Como trabalhar neste projeto

Guia rápido para as duas pessoas do time não pisarem no pé uma da outra.

---

## 1. As branches

| Branch | Para que serve | Pode commitar direto? |
|--------|----------------|----------------------|
| `main` | Código estável. É o que apresentamos na banca. | ❌ Nunca |
| `develop` | Onde o trabalho do dia a dia é integrado. | ⚠️ Evite — prefira PR |
| `feature/...` | Uma tarefa sua. Sai da `develop` e volta pra ela. | ✅ À vontade |

```
main ─────●────────────────────────●──────▶  (versões estáveis)
           \                      /
develop ────●────●────●────●────●─────────▶  (integração)
                  \    \      /
feature/login      ●────●────●                (seu trabalho)
```

---

## 2. O fluxo, na prática

**Sempre comece atualizando a `develop`:**

```bash
git checkout develop
git pull origin develop
```

**Crie sua branch a partir dela:**

```bash
git checkout -b feature/painel-relatorios
```

**Trabalhe e vá commitando:**

```bash
git add .
git commit -m "feat: adiciona filtro por período nos relatórios"
```

**Suba e abra o Pull Request para a `develop`:**

```bash
git push -u origin feature/painel-relatorios
```

O GitHub vai mostrar um link para abrir o PR. Escolha **`develop`** como destino
(não `main`), preencha o template e peça a revisão do outro.

---

## 3. Nome das branches

Use um prefixo que diga o tipo do trabalho:

| Prefixo | Quando usar | Exemplo |
|---------|-------------|---------|
| `feature/` | Funcionalidade nova | `feature/exportar-pdf` |
| `fix/` | Correção de bug | `fix/login-sem-token` |
| `docs/` | Só documentação | `docs/atualiza-readme` |
| `refactor/` | Reorganizar código sem mudar comportamento | `refactor/services-empresa` |
| `style/` | Só visual/CSS | `style/tema-claro-dashboard` |

Tudo minúsculo, palavras separadas por hífen.

---

## 4. Mensagens de commit

Formato: `tipo: o que mudou` — em português, no imperativo.

```
feat: adiciona gráfico de leituras por dia
fix: corrige contagem de itens frágeis no dashboard
docs: explica setup do Supabase no README
style: ajusta espaçamento do card de leitura
refactor: extrai parser de QR para util compartilhado
chore: atualiza dependências do frontend
```

Evite `update`, `mudanças`, `ajustes`, `wip` — daqui a um mês ninguém lembra
o que era.

---

## 5. Combinados que evitam dor de cabeça

**Divida o trabalho por área.** Se os dois mexerem no mesmo arquivo ao mesmo
tempo, o conflito é garantido. Combinem antes quem pega o quê:
por exemplo, um cuida do `frontend/` e o outro do `api-node/`.

**Puxe a `develop` com frequência.** Quanto mais tempo sua branch fica separada,
pior o merge. Uma vez por dia já resolve:

```bash
git checkout develop && git pull origin develop
git checkout sua-branch && git merge develop
```

**Nunca commite `.env`.** Ele tem senha de banco e está no `.gitignore`.
Se precisar de uma variável nova, adicione no `.env.example` (sem o valor real)
e avise o outro.

**Não commite `node_modules/` nem `dist/`.** Já estão ignorados — se aparecerem
no `git status`, algo está errado, avise antes de commitar.

**Rode o lint antes de abrir o PR:**

```bash
cd frontend && npm run lint
```

---

## 6. Quando algo dá errado

**Commitei na `main` sem querer (ainda não dei push):**

```bash
git reset --soft HEAD~1     # desfaz o commit, mantém as alterações
git stash                   # guarda de lado
git checkout develop
git stash pop               # traz de volta, agora na branch certa
```

**Deu conflito no merge:** abra os arquivos marcados, procure por `<<<<<<<`,
escolha o que fica, apague os marcadores, e então:

```bash
git add .
git commit
```

**Quero jogar fora minhas alterações locais:**

```bash
git checkout -- .           # descarta o que não foi commitado
```

**Na dúvida, pergunte antes de forçar.** Nunca use `git push --force` na `main`
ou na `develop` — isso apaga o trabalho do outro.

---

## 7. Subindo para a `main`

Quando a `develop` estiver estável (tudo funcionando, sem bug conhecido),
abra um PR de `develop` → `main`. Esse é o momento de "publicar uma versão".
