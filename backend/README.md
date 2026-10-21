# API MVC de visitas — PHP/MySQL

## Rodada de validação — 21/10/2026

Testes reais adicionais em `tests/http.php` (HTTP + banco isolado), `tests/backup.php` (backup/restauração somente descartável), `tests/audit-mysql.php` e fixture opcional `tests/browser-fixture.php`. Comandos, resultados e limites em [VALIDACAO_E2E.md](../VALIDACAO_E2E.md). Use nomes novos `visitas_test_*` e configuração separada no processo; preserve `.env`. As contagens históricas abaixo não representam esta rodada.

## Clientes, resultados e retornos — 16/10/2026

Nova migração incremental **004_clientes_resultados_retornos.sql**. Antes de iniciar, execute `composer install` e `composer migrate` (ou `php bin/migrate.php`), preservando o `.env`. Cadastros de clientes/contatos com acesso explícito, CNPJ único, retratos históricos e acompanhamento de retornos foram integrados à agenda/check-in existentes. Conclusão agora exige resultado e resumo, gravados junto do checkout; concluídas antigas permanecem legíveis e imutáveis.

Novos endpoints: GET/POST `/clientes`, GET/PATCH `/clientes/{id}`, PATCH `/clientes/{id}/acessos`, GET/POST `/clientes/{id}/contatos`, PATCH `/contatos/{id}`, GET `/clientes/{id}/visitas` e `/agendamentos`, GET `/retornos`, GET/PATCH `/retornos/{id}` e POST `/retornos/{id}/agendamento`, sob `/api/v1`.

Contratos, permissões, semântica de datas, instalação/migração/inicialização em **PowerShell e Git Bash**, exemplos e limites em [CLIENTES-E-RETORNOS.md](../CLIENTES-E-RETORNOS.md). Resultados executados em [VALIDACAO.md](VALIDACAO.md). As descrições das revisões anteriores abaixo são históricas quando houver contrato ampliado nesta etapa.

## Agenda de visitas — 15/10/2026

Agenda funcional adicionada por migração incremental **003_agenda.sql**. Execute `composer migrate` (ou `php bin/migrate.php`) antes de usar. Preserve o `.env`. Contratos, permissões, concorrência, comandos PowerShell/Git Bash e validação em [AGENDA.md](../AGENDA.md). A migração já foi aplicada ao banco local, preservando o conteúdo anterior de usuários e visitas.

Novas rotas: GET/POST `/api/v1/agendamentos`, GET/PATCH `/api/v1/agendamentos/{id}` e GET `/api/v1/agendamentos/opcoes`. POST `/api/v1/visitas` aceita `agendamento_id` opcional, com vínculo único e transação atômica. Check-in avulso e permissões anteriores preservados. Histórico de agendamentos registra autores, horários e motivos.

Validação atual: **26 unitários + 13 integrações reais aprovados**. MySQL 8 nativo não estava disponível; integração executada no MariaDB 10.4.32. O restante deste documento descreve a base existente; contagens de testes da revisão 002 abaixo são históricas.

PHP 8.2+ (64 bits), PDO/pdo_mysql, mbstring, Composer/PSR-4, MySQL 8.0.16+ e InnoDB/utf8mb4. API exclusivamente JSON; frontend separado em ../frontend. Não há fotos, e-mails ou relatórios.

## Atualização e execução

Na raiz do projeto, PowerShell:

```powershell
Set-Location backend
composer install
composer migrate
$env:RUN_DB_TESTS = '0'
php tests/run.php
php -S 127.0.0.1:8000 -t public public/index.php
```

Git Bash:

```bash
cd backend
composer install
composer migrate
RUN_DB_TESTS=0 php tests/run.php
php -S 127.0.0.1:8000 -t public public/index.php
```

**Preserve o .env existente.** Na primeira instalação apenas, copie .env.example para .env e configure DB_HOST/PORT/DATABASE/USERNAME/PASSWORD, CORS_ORIGINS e TOKEN_TTL_SECONDS. MySQL deve estar ligado. PHP e suas DLLs precisam ser da mesma versão; se não estiver no PATH, use o caminho da instalação.

001_initial.sql foi preservada. **002_reliability.sql adiciona visita_requests, login_limits e user_management_lock. Execute composer migrate antes de usar a nova versão.** O runner registra migrações aplicadas em schema_migrations; não altera registros existentes de usuários/visitas. DDL faz commit implícito: falha parcial exige inspeção/reparo antes de repetir. Execute migrações em um único processo por vez.

Exemplo de instalação inicial (valores fictícios):

```sql
CREATE DATABASE visitas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'visitas_app'@'127.0.0.1' IDENTIFIED BY 'substitua-esta-senha';
GRANT SELECT, INSERT, UPDATE, DELETE ON visitas.* TO 'visitas_app'@'127.0.0.1';
```

Migrações exigem CREATE, INDEX e REFERENCES; em produção use conta separada de implantação para DDL. O document root é **public/**. Apache exige mod_rewrite/AllowOverride; Nginx deve fazer fallback para index.php e repassar Authorization/Idempotency-Key. Use HTTPS e display_errors=Off. O bootstrap também desativa erros públicos. .env, logs, uploads e vendor não são versionados nem publicados.

## Configuração

| Variável | Default / significado |
|---|---|
| CORS_ORIGINS | Origens exatas separadas por vírgula; desenvolvimento http://localhost:4200; wildcard rejeitado |
| TOKEN_TTL_SECONDS | 28800; entre 60 e 86400 |
| LOGIN_WINDOW_SECONDS | 900; entre 1 e 86400 segundos |
| LOGIN_IP_LIMIT | 30 tentativas por origem na janela |
| LOGIN_ACCOUNT_LIMIT | 10 tentativas por identificador na janela |
| TRUSTED_PROXIES | Vazio; IPs exatos de proxies confiáveis separados por vírgula |
| GPS_MAX_AGE_SECONDS | 120; limitado pelo código a 1–120 segundos |

Variáveis novas têm defaults: adicione-as manualmente se precisar, sem substituir o .env. CORS aceita Authorization, Content-Type e Idempotency-Key e expõe Retry-After. Não usa cookies/Access-Control-Allow-Credentials.

## Autenticação e limite de login

POST /auth/login recebe email e senha (1–72 **bytes**, sem trim da senha). password_verify e ativo são verificados; inexistente/inativo/senha incorreta têm a mesma mensagem 401. Não pula verificação de hash para conta inexistente. O token é aleatório, 32 bytes em hexadecimal; auth_tokens guarda apenas SHA-256 e expiração. /me não expõe hash. Logout revoga o token atual. Perfil e ativo são consultados a cada chamada autenticada.

LoginLimiter usa tabela compartilhada login_limits, transações e bloqueios para duas chaves: origem e conta. Conta é normalizada em trim/minúsculas; as chaves são hashes, sem IP/e-mail bruto nessa tabela. Cada tentativa conta ao entrar; um login correto zera a cota da conta e devolve a tentativa à origem, então só falhas e dados inválidos se acumulam. Falhas repetidas ainda podem bloquear temporariamente uma conta conhecida até a janela expirar. Desativar um usuário ou trocar seu perfil revoga todos os tokens dele; tokens vencidos do usuário são removidos a cada novo login. Limite atingido retorna **429 e Retry-After em segundos**. Requisições bloqueadas não renovam a janela. Liberação automática após a janela evita bloqueio permanente; contas existentes/inexistentes têm a mesma política. Não registra senhas ou tokens.

Origem padrão é REMOTE_ADDR. X-Forwarded-For é ignorado salvo se o peer estiver em TRUSTED_PROXIES. A cadeia é percorrida da direita para a esquerda, removendo somente proxies confiáveis; cadeia inválida faz fallback para REMOTE_ADDR. Configure o proxy para validar/substituir cabeçalhos recebidos.

Angular guarda Bearer apenas em memória e usa withCredentials=false. Recarregar exige login. Não há JWT/refresh token, CSRF de cookie ou persistência de sessão. Não registre corpos, Authorization ou Idempotency-Key no proxy. Tokens expirados e buckets de login mais antigos que a maior janela podem ser limpos periodicamente. Não remova chaves de visitas se precisar garantir repetição indefinidamente.

## Endpoints

Prefixo **/api/v1** em todos os caminhos:

| Método | Caminho | Permissão |
|---|---|---|
| GET | /health | Público; processo HTTP, não banco |
| POST | /auth/login | Público, sujeito a limite |
| GET | /auth/me | Autenticado |
| POST | /auth/logout | Autenticado |
| GET | /responsaveis | Funcionário; somente id/nome dos responsáveis ativos |
| POST | /visitas | Funcionário; Idempotency-Key obrigatório |
| GET | /visitas | Funcionário: próprias; responsável: atribuídas; admin: todas |
| GET | /visitas/{id} | Mesmo escopo de leitura |
| PATCH | /visitas/{id} | Funcionário proprietário ou admin; em andamento |
| GET | /usuarios | Admin, paginado |
| POST | /usuarios | Admin |
| PATCH | /usuarios/{id} | Admin |

Sem DELETE. Responsável permanece somente leitura; admin não cria check-ins. Visita fora do escopo retorna 404. 405 inclui Allow; OPTIONS retorna 204.

Sucesso: `{success:true,message,data}`. Erro: `{success:false,message,errors:{campo:"..."}}`. Listas: data.items/limit/offset. Limit 1–100 (default 20); offset 0–1000000; sem total. Códigos: 200/201, 400/401/403/404/405/409/413/415/429/500. Erros internos, SQL e credenciais não são expostos.

## Check-in idempotente e GPS

POST /visitas exige Content-Type application/json, Authorization Bearer e Idempotency-Key com 16–80 caracteres ASCII alfanuméricos/hífen/sublinhado (UUID serve). Exemplo de corpo, com dados fictícios:

```json
{"contato":"Contato Teste","empresa":"Empresa Teste","assunto":"Apresentação","descricao":"Visita comercial.","responsavel_id":1,"latitude":-23.55,"longitude":-46.63,"precisao_gps":12.5,"gps_capturado_em":1791980000000}
```

Substitua gps_capturado_em pelo timestamp **atual** retornado pelo navegador, em milissegundos Unix, e responsavel_id por ID real ativo/perfil responsável. IDs/GPS são números JSON. Latitude ±90, longitude ±180, precisão 0–999999.99 metros. Textos obrigatórios: contato 150, empresa 180, assunto 200, descrição 10000 **pontos de código Unicode** (mb_strlen UTF-8, incluindo emojis). Senhas continuam medidas em bytes.

A chave única é (funcionário autenticado, chave). A transação bloqueia/reserva a chave, compara hash canônico, cria visita e salva snapshot da resposta no mesmo commit. Repetição simultânea espera commit/rollback. Mesma chave/dados retorna o snapshot original com 201, inclusive após edição posterior; dados diferentes retornam 409. Ordem de campos, números equivalentes e trim de textos não mudam o hash. Falha antes do commit desfaz visita e reserva.

Novas criações recusam GPS com idade maior que o limite, com tolerância de 5 segundos de relógio futuro. Repetição recupera primeiro uma resposta já salva, mesmo com GPS agora vencido; se não houve commit e o GPS venceu, retorna 400 sem criar. Reenvie exatamente chave e payload da tentativa incerta, sem gerar outra chave silenciosamente.

Check-in/checkout oficiais continuam definidos pelo servidor em UTC; usuario_id vem da identidade, nunca do cliente. GPS/timestamp do dispositivo não comprovam presença física. O timestamp GPS não é o horário oficial.

PATCH aceita campos textuais/status e resultado/resumo_resultado/proximo_passo/data_retorno junto da conclusão. Empresa/contato vinculados ao cadastro preservam o retrato original. Concluir exige resultado/resumo, define checkout e cria retorno quando há data, tudo na mesma transação. Concluídas são imutáveis (409). Não edita GPS, identidade, responsável ou horários. FOR UPDATE bloqueia o registro da visita.

## Filtros e nomes

GET /visitas aceita inicio/fim/status/empresa e **funcionario_id somente para admin**. Datas UTC exatas YYYY-MM-DDTHH:mm:ssZ: início incluído (>=), fim excluído (<); fim deve ser posterior ao início. Para um dia local, converta a meia-noite inicial e a meia-noite do dia seguinte para UTC. O frontend usa o fuso do dispositivo. DATETIME de resposta é UTC.

```text
/api/v1/visitas?inicio=2026-10-01T03:00:00Z&fim=2026-11-01T03:00:00Z&status=concluida&empresa=Teste&limit=20&offset=0
```

Empresa é substring literal de até 180 pontos Unicode; %, _ e ! são escapados e a collation do banco define comparação. Todos os valores são preparados. Filtros sempre são unidos com AND ao escopo obrigatório; funcionário/responsável enviando funcionario_id recebe 403. Filtros desconhecidos/invalidos retornam 400.

Consulta e listagem incluem funcionario_nome/responsavel_nome e mantêm IDs. São nomes **atuais**, obtidos por JOIN sem N+1. Não retornam hashes, e-mails ou perfis administrativos no objeto visita.

## Gestão administrativa

POST /usuarios: nome (150), email (válido, até 190), perfil, ativo booleano (default true), senha inicial 12–72 bytes. password_hash na criação. PATCH: apenas nome/email/perfil/ativo; sem troca de senha ou exclusão física. E-mail duplicado: 409. Respostas somente id/nome/email/perfil/ativo.

user_management_lock serializa operações de gestão, revalida o administrador e impede que o último admin ativo seja desativado ou perca perfil, inclusive sob concorrência. Pode editar a própria conta dentro dessa regra. Inativação invalida o acesso de tokens; alteração de perfil muda a autorização das próximas requisições.

Visitas existentes **não são reatribuídas, apagadas ou alteradas**. IDs mantêm seus vínculos; o perfil atual controla o escopo: funcionário por usuario_id, responsável por responsavel_id, admin todas. Um ex-funcionário que vira responsável perde acesso como proprietário, salvo visitas atribuídas a ele; elas continuam disponíveis aos responsáveis vinculados/admins. Ex-responsáveis continuam vinculados às visitas, mas seu perfil atual controla acesso. O seletor para novas visitas inclui apenas responsáveis ativos. Não há hierarquia de equipes.

O script de terminal foi preservado:

```powershell
$env:SEED_PASSWORD = 'crie-uma-senha-propria-123'
php bin/create-user.php 'Admin Teste' admin@example.test admin
Remove-Item Env:\SEED_PASSWORD
```

Git Bash: export SEED_PASSWORD, execute o mesmo comando e finalize com unset SEED_PASSWORD. Não passe senha como argumento.

## Arquitetura, testes e limites

public/index.php → CORS/Router → Controller/AuthMiddleware → Service → Model → Repository/PDO → Response JSON. Models não recebem HTTP; repositories não decidem permissões. HttpException inclui cabeçalhos seguros (Retry-After). Novos componentes: VisitFilters, VisitaRequestRepository, LoginLimiter e UsuarioService. Sem framework ou dependência nova.

RUN_DB_TESTS=0 php tests/run.php executa 22 testes unitários. Integração antiga via RUN_DB_TESTS=1 exige TEST_DB_DATABASE com prefixo visitas_test_ e banco dedicado migrado; nunca use o banco atual.

A nova tests/mysql.php cria um banco NOVO, aplica migrações, roda 8 testes reais, incluindo workers concorrentes, e remove somente o banco criado por ela. Recusa nome existente e o nome do banco atual. Exige CREATE/DROP DATABASE. Não mostra credenciais.

```powershell
$env:TEST_DB_DATABASE = 'visitas_test_' + [Guid]::NewGuid().ToString('N')
php tests/mysql.php
Remove-Item Env:\TEST_DB_DATABASE
```

```bash
TEST_DB_DATABASE="visitas_test_$(date +%s)_${RANDOM}" php tests/mysql.php
```

Resultados em [VALIDACAO.md](VALIDACAO.md). Ainda faltam fotos, notificações, relatórios, auditoria e recuperação de senha. Sem reabertura. A revisão não aplicou migrações no banco atual nem alterou .env/dados existentes, e não fez commit/push.

