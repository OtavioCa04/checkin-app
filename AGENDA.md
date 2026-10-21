# Agenda de visitas — atualização de 15/10/2026

Agenda disponível em **http://localhost:4200/agenda**, após login. Agendamento e visita realizada são entidades independentes. Check-in avulso continua em “Novo check-in”.

## Arquivos

Criados no backend: `database/migrations/003_agenda.sql`, `src/Models/Agendamento.php`, `src/Repositories/AgendamentoRepository.php`, `src/Services/AgendamentoService.php`, `src/Controllers/AgendamentoController.php`, `tests/agenda.php` e `tests/agenda-mysql.php`. O model valida dados/datas, o repository concentra SQL, o service aplica permissões e transações e o controller adapta HTTP/JSON.

Criados no frontend: `src/app/pages/agenda.ts`, `src/app/agenda-dates.ts` e `src/app/agenda.spec.ts`. Atualizados contratos/API, rotas/menu, cadastro e detalhes de visita, estilos e READMEs. Backend também integra o vínculo em Visita/VisitaRepository/VisitaService, registra rotas e amplia as suítes/worker de concorrência. Nenhuma dependência nova.

## Atualizar e executar

Preserve o `.env` e o banco atual. Não importe novamente a migração inicial. A migração incremental `003_agenda.sql` cria `agendamentos`, `agendamento_eventos` e o vínculo opcional e único `visitas.agendamento_id`. Não altera campos existentes de usuários ou visitas. Execute migrações com um único processo e interrompa gravações durante a atualização. DDL MySQL faz commit implícito: se houver falha parcial, inspecione antes de repetir.

PowerShell, a partir da raiz do projeto:

```powershell
Set-Location backend
composer install
composer migrate
$env:RUN_DB_TESTS = '0'
php tests/run.php
php -S 127.0.0.1:8000 -t public public/index.php
```

Em outro terminal, a partir da raiz:

```powershell
Set-Location frontend
npm ci
npm test
npm run build
npm start
```

Git Bash:

```bash
cd backend
composer install
composer migrate
RUN_DB_TESTS=0 php tests/run.php
php -S 127.0.0.1:8000 -t public public/index.php
```

Em outro terminal:

```bash
cd frontend
npm ci
npm test
npm run build
npm start
```

`php bin/migrate.php` equivale a `composer migrate`. Se PowerShell bloquear npm.ps1, use npm.cmd. PHP precisa de pdo_mysql/mbstring; Node deve ser compatível com Angular 21. As dependências não mudaram nesta atualização.

## Permissões e estados

| Perfil | Consulta | Criação | Reagendar/cancelar | Iniciar visita |
|---|---|---|---|---|
| Funcionário | Próprios | Próprios | Próprios, pendentes | Próprios, pendentes |
| Responsável | Atribuídos | Não | Não | Não |
| Administrador | Todos | Para funcionários ativos | Todos os pendentes | Não |

Novos agendamentos exigem funcionário e responsável ativos com os respectivos perfis. Funcionário autenticado não pode escolher outro proprietário. GET /usuarios e GET /responsaveis mantêm as permissões anteriores. A agenda tem suas próprias opções mínimas (somente IDs e nomes). O backend aplica todas as regras e retorna 404 para registros fora do escopo.

Estados persistidos: `pendente`, `realizado`, `cancelado`. A interface calcula `atrasado` para pendente com horário vencido; o filtro atrasado usa UTC_TIMESTAMP no backend. Não há job que cancele automaticamente. `pendente` inclui atrasados. É permitido iniciar um pendente antes ou depois do horário previsto. Realizado significa que o check-in foi criado, independentemente de o checkout já ter ocorrido.

Reagendar e cancelar exigem motivo (até 1000 pontos Unicode). Só pendentes podem mudar. Data nova/criação deve ser futura segundo o servidor. Histórico registra autor, horário oficial UTC, ação, motivo, data anterior e nova. Trocar responsável (`trocar_responsavel`) também exige motivo e aceita só responsável ativo; o histórico guarda o anterior no motivo. Use quando o responsável original foi desativado, pois o check-in exige responsável ativo. Não há exclusão, reabertura, troca de funcionário ou edição dos demais dados do planejamento: cancele e crie outro se necessário. Alterações de perfil/inativação preservam vínculos existentes.

## Contratos da API

Prefixo `/api/v1`, Bearer em memória no frontend, respostas JSON existentes `success/message/data` ou `success/message/errors`:

| Método | Caminho | Uso |
|---|---|---|
| GET | /agendamentos | Lista paginada no escopo autenticado |
| POST | /agendamentos | Cria planejamento |
| GET | /agendamentos/opcoes | Funcionário/admin, funcionários e responsáveis ativos com id/nome |
| GET | /agendamentos/{id} | Dados, visita_id e eventos de auditoria |
| PATCH | /agendamentos/{id} | Reagendar, cancelar ou trocar responsável |
| POST | /visitas | Check-in existente com agendamento_id opcional |

GET aceita `limit` (1–100), `offset`, `inicio`, `fim`, `status` e `funcionario_id` (apenas admin). Datas de filtro/criação/reagendamento usam UTC exato `YYYY-MM-DDTHH:mm:ssZ`; início incluído e fim excluído. Retorno DATETIME é UTC. Filtros sempre restringem o escopo, nunca o substituem. Lista retorna `data.items/limit/offset`, sem total. A última página cheia pode permitir avançar para uma vazia.

Exemplo de criação (IDs fictícios; substituir por IDs ativos):

```json
{
  "usuario_id": 2,
  "responsavel_id": 3,
  "empresa": "Empresa Teste",
  "contato": "Contato Teste",
  "assunto": "Apresentação",
  "observacoes": "Levar proposta atualizada.",
  "data_hora_prevista": "2028-01-02T12:00:00Z"
}
```

Empresa (180), contato (150), assunto (200) obrigatórios; observações opcionais até 10000 pontos Unicode. No perfil funcionário, usuario_id pode ser omitido: é definido pela identidade. IDs são números JSON.

```json
{"acao":"reagendar","motivo":"Novo horário combinado com o contato.","data_hora_prevista":"2028-01-03T14:00:00Z"}
```

```json
{"acao":"cancelar","motivo":"Contato cancelou a reunião."}
```

```json
{"acao":"trocar_responsavel","motivo":"Responsável anterior desligado.","responsavel_id":4}
```

Para iniciar, a UI abre o check-in existente, preenche contato/empresa/assunto/descrição a partir das observações e fixa o responsável do agendamento. Revise os dados e preencha a descrição se o planejamento não tinha observações. Capture GPS atual. POST /visitas recebe os campos já documentados, mais `agendamento_id` numérico, mantendo `Idempotency-Key`. Funcionário e check-in oficial continuam vindos da identidade e do relógio do servidor. Campos textuais do registro realizado podem refletir o que aconteceu em campo.

## Concorrência e atomicidade

A transação do check-in reserva a chave idempotente e bloqueia o agendamento com FOR UPDATE. Confere proprietário, pendência e responsável; cria visita, altera estado para realizado, grava evento e snapshot da resposta no mesmo commit. Qualquer falha desfaz tudo. O índice UNIQUE em visitas.agendamento_id garante no máximo uma visita mesmo sob requisições com chaves diferentes; múltiplos NULL preservam check-ins avulsos. Cancelamento/reagendamento também bloqueiam o mesmo registro. Em uma disputa entre cancelamento e início, uma operação vence e a outra recebe 409. A resposta idempotente já salva continua recuperável após realização.

Agenda não guarda GPS antecipado. O cadastro usa a captura do navegador e o horário oficial existente. Não há fotos, e-mails ou relatórios nesta etapa.

## Validação realizada

- PHP: **26 testes unitários aprovados** e verificação sintática dos arquivos PHP.
- Banco local: **13 testes de integração aprovados** em MariaDB 10.4.32, com migrações 001/002/003 aplicadas em banco novo exclusivo e removido ao final. Incluem autorizações, pessoas inativas, datas, filtros, auditoria, cancelamento, rollback depois do INSERT, restrição única e workers PHP concorrentes para iniciar/iniciar e iniciar/cancelar.
- Angular: **53 testes aprovados** (40 anteriores + 13 da agenda), com contratos HTTP, permissões da interface, formulários, datas locais/UTC, filtros, respostas atrasadas, início com GPS/vínculo e bloqueio de cancelados.
- Build Angular de produção executado com sucesso.
- Migração 003 aplicada ao banco local existente. Conteúdo dos campos anteriores de usuários/visitas comparado antes/depois e preservado. `.env` manteve seu hash original. Sem commit/push.

Não foi executado teste em MySQL 8 nativo nem teste manual autenticado em navegador/dispositivo com GPS real. Integração de banco usa MariaDB disponível; testes de frontend usam jsdom e HttpTestingController. Não se declaram essas validações não executadas como aprovadas.

Para repetir integração isolada (credencial precisa CREATE/DROP DATABASE e TRIGGER para teste de rollback), no backend:

```powershell
$env:TEST_DB_DATABASE = 'visitas_test_' + [Guid]::NewGuid().ToString('N')
php tests/mysql.php
Remove-Item Env:\TEST_DB_DATABASE
```

```bash
TEST_DB_DATABASE="visitas_test_$(date +%s)_${RANDOM}" php tests/mysql.php
```

Nunca use o banco atual como TEST_DB_DATABASE. A suíte recusa reutilizar bancos existentes.
