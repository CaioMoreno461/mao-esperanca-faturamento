# Mão de Esperança — Gestão Financeira

Aplicação web interna, responsiva e instalável para controlar orçamentos,
recebimentos, caixa, honorários de profissionais de medicina dentária e custos
de laboratórios de prótese.

> Estado atual: MVP funcional com dados fictícios. Não é software de faturação
> fiscal e não emite faturas para a Autoridade Tributária.

## Regra financeira

Todos os valores são guardados como inteiros em cêntimos.

- Sem protético: clínica = total recebido ÷ 2; profissional = total recebido ÷ 2.
- Com protético: primeiro é retirado o custo do laboratório; clínica e
  profissional recebem metade do restante.
- Fórmula: `parte = (total recebido - custo protético) / 2`.
- Quando existe um cêntimo indivisível, ele fica na parte da clínica para manter
  a soma contabilística exata.
- A dívida do paciente é `máximo(orçamento - recebido, 0)`.

A divisão é calculada sobre o valor efetivamente recebido, não apenas sobre o
orçamento. Se o recebido ainda não cobrir o custo protético, o painel sinaliza
o caso e não apresenta esse saldo negativo como uma obrigação pagável.

## Funcionalidades

- Painel com total recebido, parte da clínica, valores a pagar e dívidas.
- Orçamentos com pagamentos parciais e evolução do saldo do paciente.
- Registo de trabalhos protéticos por laboratório e por caso.
- Cadastro de profissionais e laboratórios.
- Caixa unificado: entradas, despesas, honorários e pagamentos a laboratórios.
- Agenda interna e importação temporária por CSV.
- Histórico técnico de alterações para auditoria.
- Layout para computador, tablet e telemóvel.
- Manifesto de aplicação web para instalação pelo navegador.

## Integração com a MinhaAgenda

A MinhaAgenda não disponibiliza documentação pública de API. Os termos do
fornecedor proíbem bots, scraping, engenharia reversa e integrações não
homologadas sem autorização prévia e escrita.

Por segurança, este projeto:

- não guarda nem reutiliza a palavra-passe da MinhaAgenda;
- não faz scraping do portal;
- não tenta descobrir endpoints privados;
- mantém uma fronteira de integração em
  `lib/integrations/minha-agenda.ts`;
- aceita um CSV controlado enquanto o acesso oficial não é fornecido.

Para ativar a sincronização automática, a clínica deve obter da HighEnd
Tecnologia autorização escrita, documentação, URL oficial da API e credenciais
próprias de integração. O token deverá ser configurado apenas no ambiente do
servidor.

## Modelo CSV temporário

O ficheiro `public/modelo-importacao-agenda.csv` usa estas colunas:

```text
id_externo,paciente,telefone,email,servico,data_hora,profissional,estado,valor
```

Datas devem estar em ISO 8601, preferencialmente com fuso horário, por exemplo
`2026-08-25T10:00:00+01:00`.

## Estrutura técnica

- Next.js/Vinext + React + TypeScript
- Cloudflare Worker
- D1/SQLite para persistência
- Drizzle para esquema e migrações
- API interna em `app/api/finance/route.ts`
- Regras monetárias puras em `lib/finance.ts`
- Interface principal em `app/components/FinanceApp.tsx`

Tabelas principais:

- `patients`
- `professionals`
- `laboratories`
- `treatment_cases`
- `payments`
- `lab_jobs`
- `payouts`
- `expenses`
- `appointments`
- `audit_logs`

## Desenvolvimento

Requisitos:

- Node.js 22.13 ou superior
- npm

```bash
npm ci
npm run dev
```

Validação:

```bash
npm test
npm run lint
```

Depois de alterar `db/schema.ts`, gere uma nova migração:

```bash
npm run db:generate
```

## Segurança e proteção de dados

O projeto deve permanecer privado e com acesso restrito à equipa autorizada.
Antes de usar pacientes reais:

1. Defina quem pode consultar, inserir e liquidar valores.
2. Ative autenticação e política de acesso restrita no ambiente de produção.
3. Não introduza diagnósticos, fichas clínicas ou anamneses; este sistema é
   financeiro e operacional.
4. Formalize a base legal e as responsabilidades de tratamento de dados
   aplicáveis à clínica em Portugal.
5. Estabeleça cópias de segurança, retenção, exportação e resposta a incidentes.

## Dados demonstrativos

Na primeira execução, a base é preenchida com pessoas e valores totalmente
fictícios para permitir avaliação do fluxo. Esses registos não representam
pacientes reais.
