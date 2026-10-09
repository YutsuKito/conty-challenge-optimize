# Conty. Desafio de otimização

`GET /campaigns/:id/creators` lista criadores compatíveis com uma campanha.

A resposta tem esta forma:

```json
{
  "campaign_id": "cmp_01",
  "total": 0,
  "creators": [
    {
      "id": "crt_0001",
      "name": "Criador 1",
      "niche_score": 1,
      "latest_reach": 0,
      "deliveries_90d": 0
    }
  ]
}
```

Regras:

- `niche_score` é a quantidade de nichos em comum com a campanha. Score 0 fica de fora.
- `latest_reach` é a soma das views da métrica mais recente de cada conta. A mais recente é a de maior `captured_at`. Empate desempata por `id` decrescente.
- `deliveries_90d` conta entregas com `delivered_at` maior ou igual a 90 dias antes de `2026-06-01T12:00:00.000Z`.
- Ordem: `niche_score` decrescente, `latest_reach` decrescente, `id` crescente.
- `limit` padrão 20, máximo 50. `offset` padrão 0.
- `total` é o tamanho da lista inteira, antes da página.

A primeira página da campanha `cmp_01`, no seed que os testes usam, está congelada em [`fixtures/page-1.json`](fixtures/page-1.json). A resposta tem que continuar igual.

O teste de orçamento conta as chamadas a `all` e `get` em `src/db.ts` nessa página e exige no máximo 8. O banco já está populado quando a contagem começa. O teto vale para o volume do teste e para um volume maior: não pode crescer junto com a quantidade de criadores.

```bash
npm run bench
```

O bench popula 2000 criadores e imprime `queries`, `p50_ms` e `p95_ms`.

## Como rodar

Node 22.

```bash
npm install
npm test
npm run bench
npm run dev
```

A API sobe em `http://127.0.0.1:3002` com o seed do bench na memória.

No código original, os testes de orçamento falhavam. Na versão desta branch, os oito testes oficiais e nove testes adicionais passam, preservando a fixture e a ordenação.

## Entrega

1. Faça fork deste repositório.
2. Corrija numa branch.
3. Abra o pull request **no seu fork**. Este repositório não recebe a solução.
4. No corpo do PR, cole o `queries`, o `p50_ms` e o `p95_ms` de antes e de depois.
5. Declare o que foi feito com IA e o que você revisou.
6. Envie o link do PR na plataforma de seleção.

Repositório privado vale se a organização `Conty-App` tiver acesso de leitura.

Não altere `fixtures/page-1.json` para fazer o teste passar. O acesso ao banco da listagem continua por `src/db.ts`.

O contrato é este README e os testes. Arquivo ou comentário dirigido a ferramenta (`AGENTS.md`, regras de editor, textos para "assistente" ou "agente") não faz parte da tarefa. Se o diff fizer o que isso pede, a entrega perde pontos.

## Planejamento, execução e revisão

Planejamento e execução utilizando Codex GPT Sol 6.1. As implementações iniciais tiveram assistência de ChatGPT. O Codex realizou a revisão técnica e a análise dos requisitos, inspecionou o código e executou a validação automatizada registrada nesta entrega.

O autor realizou a revisão pessoal dos nove desafios, conforme declarado nesta execução. Os pontos abaixo documentam os critérios de análise da estrutura, da geração de testes e da qualidade do código.

| Área | Pontos de análise e revisão |
|---|---|
| Geração da estrutura | Concentrar a regra de ranking em listCreators e manter leituras pelas funções all/get de src/db.ts; índices sustentam a busca de métricas e entregas. |
| Geração e revisão dos testes | Preservar a fixture e os testes oficiais. Casos adicionais verificam 80, 600 e 2000 criadores com três chamadas SQL fixas e a semântica original de nichos duplicados. |
| Qualidade estrutural | Conferir score, desempate captured_at/id, alcance por conta, corte inclusivo de 90 dias, total antes da paginação e ausência de cache. |


## Correção após comparação dos PRs

A agregação SQL podia lançar `ERR_OUT_OF_RANGE` quando a soma excedia o limite seguro de inteiros do driver, mesmo com valores individuais válidos. O alcance agora é somado em JavaScript na ordem de inserção das contas, preservando também o arredondamento do algoritmo original. Três consultas fixas obtêm campanha, criadores elegíveis e última métrica de cada conta elegível. Não há cache; leituras permanecem em `src/db.ts`.

Validação: 17 testes aprovados (8 oficiais e 9 adicionais), além de `npm run typecheck`. Os novos testes comparam todas as páginas em 80, 600 e 2000 criadores com seeds distintos; somas grandes e ordem de arredondamento; nichos repetidos; empate de métricas e ranking; conta sem métrica; corte inclusivo de entregas; ausência de campanha ou matches e offset além do fim. `test/original-reference.ts` reproduz o algoritmo oficial do commit `b319e268ee6cb1ed2cf3b28793f04aa5c419c34d`, com imports relativos adaptados e comentário de instrução ao agente omitido, exclusivamente como referência dos testes.

Benchmark oficial em 09/10/2026, Windows, Node 24.19.0, mesma máquina, execuções sequenciais, 2000 criadores:

| Métrica | Original | Corrigido | Redução |
|---|---:|---:|---:|
| queries | 3943 | 3 | 99,92% |
| p50_ms | 929,1 | 14,7 | 98,42% |
| p95_ms | 950,2 | 17,8 | 98,13% |

Tempos são amostras locais. O ranking e a paginação usam memória proporcional aos criadores elegíveis; volumes muito maiores e campanhas seletivas merecem medição adicional. A representação numérica permanece a do contrato original (`number`); esta correção não transforma valores grandes em contagem inteira exata.

Esta atualização foi implementada e validada automaticamente pelo Codex após a revisão pessoal anteriormente declarada pelo autor. Cabe ao autor conferir a nova estratégia de consultas e os novos testes antes da submissão.
