# Radar

Rastreador pessoal de vagas de **estágio, trainee, bolsa e júnior em desenvolvimento**, só em empresas grandes: big techs, bancos, fintechs e multinacionais. Ele coleta as vagas direto dos sistemas de recrutamento das empresas, filtra o que é de entrada e de tecnologia, separa Brasil e exterior e organiza tudo num kanban de candidaturas.

**[Abrir o Radar](https://luissillva.github.io/RadarVagas/)**

![Board do Radar](docs/board.png)

## Como funciona

```
collector/companies.ts ──► GitHub Actions (a cada 4h)
                             │  coleta: Gupy · Greenhouse · Lever · Ashby · SmartRecruiters · Workday · Eightfold · Amazon
                             │  filtro por regras: nível + área de dev + Brasil/exterior + remoto
                             ▼
                          public/jobs.json ──► next build (site estático) ──► GitHub Pages
                                                                                 │
                                                       seu board (etapas, notas) ◄┘ salvo no navegador
```

Não tem banco, servidor, token nem chave de API. É um site estático: o GitHub Actions coleta as vagas, gera o site com elas e publica. Você abre o link e usa.

**Sem scraping de LinkedIn.** As vagas vêm das APIs públicas que alimentam as próprias páginas de carreira das empresas. É mais estável, respeita os termos de uso e traz o link oficial da candidatura.

**Só empresa grande, por construção.** O coletor só busca nas empresas de [`collector/companies.ts`](collector/companies.ts). O arquivo explica como descobrir o ATS de uma empresa pela URL da página de vagas.

**Filtro por regras.** [`collector/classify.ts`](collector/classify.ts) decide nível, área e região pelo título e pelo local. `Estágio em Desenvolvimento` entra; `Senior Software Engineer` e `Estágio em Marketing` saem. Títulos genéricos como `Programa de Estágio 2027` entram, porque é melhor ver a mais do que perder uma vaga.

**Histórico sem banco.** A cada coleta, o coletor baixa o `jobs.json` já publicado e junta com o novo: a vaga mantém a data em que apareceu, e a que sumiu da fonte fica marcada como encerrada por 30 dias. Se uma fonte cair, as vagas dela continuam como estavam.

**Seu board fica no navegador.** Etapa de cada vaga e notas ficam salvas no `localStorage`. O botão de download no topo exporta um backup em JSON, e o de upload importa em outro computador. Vagas achadas fora do radar (LinkedIn, indicação) entram pelo botão **Adicionar vaga**.

## Rodando localmente

Node 22+:

```bash
npm install
npm run collect   # coleta as vagas e grava public/jobs.json
npm run dev       # http://localhost:3000
npm test          # regras de filtro, leitura de cada ATS e junção com a coleta anterior
```

## Publicando o seu

1. Faça um fork.
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
3. Em **Actions**, rode **Coletar vagas e publicar**. O site sai em `https://<seu-usuário>.github.io/<repo>/`.

O GitHub pausa workflows agendados depois de 60 dias sem atividade no repositório. Se a coleta parar, é só rodar o workflow de novo.

## Estrutura

```
collector/
  companies.ts      lista curada de empresas e onde ficam as vagas delas
  sources/          um adaptador por ATS, todos devolvendo RawJob
  classify.ts       regras de nível, área, região e remoto
  collect.ts        orquestra coleta, filtro e junção com a coleta anterior
scripts/collect.ts  gera public/jobs.json
src/
  app/page.tsx      lê o jobs.json no build
  components/       board, colunas, cartões, painel de detalhes, cadastro manual
  lib/board.ts      estado do board no navegador, backup
```

## Próximos passos

- Notificação no Telegram quando aparecer vaga nova numa empresa favorita
- Mais fontes: Google Careers, Cia de Talentos
- Versão em inglês da interface
