# Clientes, contatos, resultados e retornos — 16/10/2026

Esta etapa amplia a API PHP/MySQL e o Angular existentes. Reutiliza autenticação, autorização de visitas, agenda, GPS, checkout oficial, respostas JSON, paginação e idempotência. Não adiciona dependências, fotos, e-mails, recuperação de senha ou relatórios.

## Atualizar, instalar e iniciar

Preserve o `.env` e o banco existente. Aplique apenas as migrações pendentes com o runner: **004_clientes_resultados_retornos.sql** cria os cadastros, acessos e retornos e adiciona vínculos/resultados opcionais às tabelas existentes. As migrações 001–003 não foram alteradas. Não importe novamente o esquema inicial. Execute migrações em um único processo, com gravações pausadas. DDL tem commit implícito: falha parcial exige inspeção antes de repetir.

PowerShell, na raiz deste projeto (pasta que contém backend e frontend):

```powershell
Set-Location backend
composer install
composer migrate
$env:RUN_DB_TESTS = '0'
php tests/run.php
php -S 127.0.0.1:8000 -t public public/index.php
```

Outro terminal:

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

Outro terminal:

```bash
cd frontend
npm ci
npm test
npm run build
npm start
```

Se estiver na pasta de trabalho do Codex, entre primeiro em `outputs`. `php bin/migrate.php` equivale a `composer migrate`. Em PowerShell, use `npm.cmd` se a política bloquear npm.ps1. Requisitos: PHP 8.2+ com pdo_mysql/mbstring, Composer, MySQL e Node compatível com Angular 21. Nenhuma instalação precisa sobrescrever `.env`; `.env.example` serve apenas à primeira instalação.

Abra http://localhost:4200. A API continua em http://127.0.0.1:8000/api/v1. A URL é configurada em frontend/src/app/config.ts. Token permanece somente em memória; recarregar exige login.

Na sessão de validação, a porta 4200 já respondia com outro sistema. Para testar esta versão foi usada **http://127.0.0.1:4201**, preservando o processo existente e o `.env`. Para repetir essa alternativa, inicie o backend em PowerShell com `$env:CORS_ORIGINS='http://localhost:4200,http://localhost:4201,http://127.0.0.1:4201'` antes de `php -d variables_order=EGPCS -S 127.0.0.1:8000 -t public public/index.php` e o frontend com `npm start -- --port 4201`. No Git Bash use `CORS_ORIGINS='http://localhost:4200,http://localhost:4201,http://127.0.0.1:4201' php -d variables_order=EGPCS -S 127.0.0.1:8000 -t public public/index.php` e `npm start -- --port 4201`. A variável vale somente para o processo/terminal, sem substituir a configuração salva.

## Clientes, contatos e acesso

Clientes têm nome_empresa obrigatório (180), nome_fantasia opcional (180), CNPJ opcional, endereço estruturado em campos separados, observações (10000), ativo, criado_por e timestamps UTC. Endereço: cep (8 dígitos sem máscara), logradouro (200), numero (30), complemento (150), bairro/cidade/pais (100 cada) e uf (2 letras). Campos do endereço são opcionais. Não há consulta automática de CEP ou Receita Federal.

CNPJ é string, normalizado sem pontuação e em maiúsculas, preservando zeros iniciais. Aceita formato numérico e alfanumérico, com validação de dígitos segundo o [manual oficial da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj). A interface aplica máscara de apresentação; o armazenamento usa 14 caracteres. Vazio vira NULL. O índice UNIQUE resolve duplicidade inclusive em concorrência. Funcionário recebe 409 genérico, sem ID, nome ou outros dados de cadastros fora do escopo; admin recebe indicação de CNPJ duplicado.

Contatos pertencem a um cliente: nome (150) obrigatório; cargo (120), e-mail válido (190) e telefone (40) opcionais; principal e ativo booleanos. E-mail e telefone não são identificadores únicos e podem se repetir. Existe no máximo um contato principal ativo por cliente: transação com bloqueio do cliente e índice único em coluna gerada. Marcar outro principal desmarca o anterior. Inativar contato remove sua indicação de principal. Não existem endpoints DELETE de cliente/contato.

| Perfil | Consultar | Cadastrar/editar | Situação e vínculos |
|---|---|---|---|
| Admin | Todos | Todos | Ativa/inativa e define funcionários com acesso |
| Funcionário | Vínculo explícito ou histórico próprio de visitas/agenda | Clientes com vínculo explícito; novos cadastros recebem o vínculo do criador | Não altera situação nem atribui acesso |
| Responsável | Clientes presentes nas visitas/agenda atribuídas | Somente leitura | Não altera |

Funcionário com vínculo explícito pode cadastrar e consultar todos os contatos daquele cliente antes da primeira visita. Sem vínculo explícito, o histórico próprio ainda permite leitura do cliente e dos contatos efetivamente utilizados nesse histórico. Responsável lê somente os contatos utilizados em suas visitas/agendamentos. A existência de um cliente compartilhado não libera visitas/agendamentos de outros funcionários: o histórico é filtrado também pelo escopo de cada registro.

Admin atribui acesso a funcionários ativos. O endpoint substitui a lista explícita inteira, sem reatribuir visitas, agendamentos ou retornos. Remover um vínculo impede novos registros com aquele cliente pelo funcionário; o histórico próprio permanece legível. Cadastros criados por admin precisam de atribuição explícita antes de serem utilizados por um funcionário. Mesmo um agendamento criado pelo admin valida o vínculo do funcionário escolhido.

Todos os IDs recebidos são validados no backend. Busca paginada também respeita o escopo; não há diretório global para funcionários/responsáveis. Cliente fora do escopo retorna 404, alteração não autorizada retorna 403. Apenas admin envia ativo em atualizações. Funcionário pode omitir ativo na criação; o cadastro nasce ativo.

## Integração e retrato histórico

Agendamento e check-in continuam aceitando empresa/contato em texto. **cliente_id** e **contato_id** são opcionais e numéricos; contato_id exige cliente_id. Não há deduplicação nem vinculação automática de registros antigos por nome, CNPJ, telefone ou e-mail.

Ao enviar IDs, o serviço verifica cliente ativo, vínculo do funcionário e contato ativo pertencente àquele cliente, dentro da transação. Nome da empresa e do contato vinculado são definidos pelo cadastro do servidor. `cadastro_snapshot` guarda JSON com empresa, fantasia, CNPJ, endereço e nome/cargo/e-mail/telefone do contato no momento do registro. Na resposta, esse campo é uma string JSON ou NULL, conforme o PDO. O frontend mostra o retrato no detalhe da visita; nunca busca o cadastro atual para substituir o histórico.

Atualizar cadastro não altera empresa, contato ou retrato de visitas/agendas anteriores. Esses nomes vinculados não podem ser reescritos por PATCH da visita. Outros campos textuais em andamento mantêm as regras anteriores. Agendamento com vínculos exige que o check-in mantenha os mesmos IDs; no check-in o servidor captura um retrato novo do cadastro atual, preservando o planejamento anterior. Cadastros inativos continuam no histórico, mas não podem ser usados em novo agendamento/check-in ou nova geração de agenda de retorno. Não há reativação automática.

Idempotency-Key e a transação de check-in foram preservados. A chave inclui os IDs no hash canônico. Repetição de uma tentativa salva devolve o retrato original, mesmo após renomeação/inativação; uma nova tentativa revalida o cadastro. Funcionário e horário oficial continuam definidos pela identidade e pelo servidor. Check-in avulso permanece disponível.

## Resultado e próximos retornos

Status operacional continua `em_andamento`/`concluida`. Ao concluir via PATCH, informe resultado (`realizada`, `sem_contato`, `reagendar` ou `cancelada`) e resumo_resultado obrigatório, até 10000 caracteres. proximo_passo é opcional (10000); data_retorno é opcional, um dia válido `YYYY-MM-DD`.

```json
{
  "status": "concluida",
  "resultado": "reagendar",
  "resumo_resultado": "Contato pediu uma nova conversa.",
  "proximo_passo": "Apresentar proposta revisada.",
  "data_retorno": "2028-01-03"
}
```

Resultado, checkout UTC oficial e eventual criação de retorno são gravados na mesma transação. Falha em qualquer etapa desfaz tudo. Resultado não pode ser salvo isoladamente em visita em andamento. Visitas já concluídas continuam imutáveis. Concluídas antigas, com resultado NULL, permanecem legíveis sem preenchimento retroativo. Visitas antigas ainda em andamento usam o novo formulário quando forem concluídas. Somente funcionário proprietário e admin podem concluir.

Informar data_retorno cria uma pendência separada, única por visita. Sem data não há retorno. A data pode representar uma pendência vencida e não é convertida em timestamp. **É dia de calendário, compartilhado entre usuários, independente do fuso.** UI exibe DD/MM/YYYY usando os componentes da string, sem Date/UTC. “Hoje” compara com o dia local do dispositivo. Filtros inicio/fim de retornos também usam YYYY-MM-DD, início incluído e fim excluído. `referencia` define o dia local para filtros hoje/atrasado; a UI envia seu dia atual. Se omitido na API, o padrão é o dia UTC do servidor. Datas da agenda continuam timestamps UTC exatos, convertidos de datetime-local.

Funcionário acompanha seus retornos, responsável consulta atribuídos e admin acompanha todos. Funcionário proprietário/admin podem encerrar como realizado/cancelado com observação obrigatória de até 1000 caracteres. Retorno registra encerrado_por, encerrado_em UTC e observacao; encerrados não podem ser alterados. Nada disso atualiza a visita de origem.

Gerar agenda é uma ação explícita e confirmada, com nova data/hora futura. Reutiliza AgendamentoService, responsável/funcionário e dados de origem. Retorno continua pendente. Bloqueio FOR UPDATE do retorno, índice UNIQUE agendamentos.retorno_id e transação conjunta garantem uma agenda sob concorrência. Repetir a mesma data retorna a agenda existente; outra data retorna 409. Uma repetição já concluída continua recuperável mesmo após o horário vencer. Se houver falha de conexão, use Atualizar retorno antes de escolher outro horário. Não há criação automática, e encerrar retorno não cancela a agenda gerada. Ajustes posteriores da agenda usam suas ações existentes.

## Novos endpoints

Todos usam `/api/v1`, autenticação existente e envelope `success/message/data` ou `success/message/errors`. Listas retornam items/limit/offset, sem total, com limit 1–100 e offset 0–1000000.

| Método | Caminho | Corpo/filtros |
|---|---|---|
| GET | /clientes | q, ativo=0/1, limit, offset; escopo obrigatório |
| POST | /clientes | nome_empresa e campos opcionais descritos acima |
| GET | /clientes/{id} | Detalhes autorizados, pode_editar; funcionários vinculados somente para admin |
| PATCH | /clientes/{id} | Campos cadastrais; ativo somente admin |
| PATCH | /clientes/{id}/acessos | Admin: `{"funcionarios_ids":[2,4]}` substitui vínculos explícitos |
| GET | /clientes/{id}/contatos | ativo=0/1, limit, offset; escopo de contatos |
| POST | /clientes/{id}/contatos | nome, cargo, email, telefone, principal e ativo conforme perfil |
| PATCH | /contatos/{id} | Campos do contato; não muda cliente_id |
| GET | /clientes/{id}/visitas | Histórico autorizado paginado |
| GET | /clientes/{id}/agendamentos | Histórico autorizado paginado |
| GET | /retornos | inicio, fim, status, referencia, funcionario_id apenas admin, limit/offset |
| GET | /retornos/{id} | Detalhes e auditoria de encerramento |
| PATCH | /retornos/{id} | `{"status":"realizado","observacao":"Ligação concluída."}` |
| POST | /retornos/{id}/agendamento | `{"data_hora_prevista":"2028-01-03T12:00:00Z"}` |

Retornos aceitam status pendente/realizado/cancelado/hoje/atrasado; hoje e atrasado são filtros derivados para pendentes. ativo é booleano nos corpos JSON. CNPJ e CEP são strings. IDs/GPS permanecem números JSON. Erros de validação usam 400, credenciais 401, permissões 403/404, conflitos 409. Não há SQL, hashes de senha ou detalhes internos em respostas públicas.

## Interface e arquivos

Menu Clientes: busca/situação/paginação, cadastro/edição, contatos, atribuições administrativas e histórico autorizado. Menu Retornos: filtros/paginação, indicadores hoje/atrasado, detalhes, encerramento e geração de agenda com confirmação. Filtros ficam na URL e acompanham os links aos detalhes e a volta. No cliente, paginação de contatos e do histórico também é lembrada ao abrir uma visita. Guards e beforeunload protegem alterações não salvas; respostas antigas são ignoradas após troca de registro/filtro.

No backend: Models Cliente/Resultado, Repositories ClienteRepository/RetornoRepository, Services ClienteService/RetornoService e Controllers ClienteController/RetornoController. SQL fica nos repositories; serviços validam autorização e coordenam transações. VisitaService/AgendamentoService foram integrados, sem duplicar a criação da agenda.

No Angular: pages/clients.ts, pages/returns.ts, customer-picker.ts, client-fields.ts e customer-shared.ts; contratos, API, menu, rotas e formulários existentes atualizados. Novas verificações em customers.spec.ts e backend/tests/clientes.php/clientes-mysql.php; worker de concorrência ampliado. Sem commit/push nesta etapa.

## Testes e limites

Os resultados finais executados estão nos VALIDACAO.md de cada aplicação. Integração usa somente banco novo com prefixo visitas_test_, diferente do banco atual; cria o esquema e fixtures e remove esse banco ao final. Não rode fixtures/testes destrutivos no banco em uso. Precisa CREATE/DROP DATABASE e TRIGGER para simular falhas transacionais.

Resultado executado em 16/10/2026: **33 unitários PHP, 22 integrações MariaDB e 76 testes Angular aprovados; build de produção concluído**. Sintaxe PHP verificada em 46 arquivos, sem falhas. A migração 004 foi aplicada ao banco local com comparação de conteúdo dos campos antigos de usuários/visitas/agenda/eventos, preservados; `.env` inalterado. Sem commit/push.

No backend, PowerShell:

```powershell
$env:TEST_DB_DATABASE = 'visitas_test_' + [Guid]::NewGuid().ToString('N')
php tests/mysql.php
Remove-Item Env:\TEST_DB_DATABASE
```

Git Bash:

```bash
TEST_DB_DATABASE="visitas_test_$(date +%s)_${RANDOM}" php tests/mysql.php
```

Não foram executados MySQL 8 nativo, teste manual autenticado em dispositivo com GPS real nem testes de carga. Integração usa MariaDB 10.4.32 disponível; Angular usa jsdom/HttpTestingController. A consulta da Receita valida apenas o algoritmo documental usado na implementação, sem consulta de situação cadastral. Não há importação/deduplicação automática, exclusão física, reabertura de concluídas, agenda recorrente ou notificações. Dados fictícios existem somente nos testes e exemplos documentais.
