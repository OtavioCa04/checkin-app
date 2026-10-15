# Atualização do sistema — 15/10/2026

**Agenda implementada:** execute a migração incremental 003 com os comandos abaixo. Documentação atual e resultados em [AGENDA.md](AGENDA.md). A migração 003 já foi aplicada ao banco local preservando usuários e visitas. O relato sobre a migração 002 abaixo corresponde à revisão anterior.

Antes de executar, interrompa os servidores antigos com Ctrl+C. Preserve o .env e mantenha o MySQL ligado. Não copie .env.example sobre a configuração existente.

## Windows / PowerShell

A partir da raiz do projeto, atualize o backend:

```powershell
Set-Location outputs/backend
composer install
composer migrate
$env:RUN_DB_TESTS = '0'
php tests/run.php
php -S 127.0.0.1:8000 -t public public/index.php
```

Em um segundo terminal, a partir da raiz:

```powershell
Set-Location outputs/frontend
npm ci
npm test
npm run build
npm start
```

Se npm.ps1 for bloqueado, use npm.cmd. Se PHP/Composer/Node não estiverem no PATH, configure suas instalações compatíveis; o projeto exige PHP 8.2+, pdo_mysql/mbstring e Node 20.19+, 22.12+ ou 24+.

## Git Bash

```bash
cd outputs/backend
composer install
composer migrate
RUN_DB_TESTS=0 php tests/run.php
php -S 127.0.0.1:8000 -t public public/index.php
```

Em outro terminal:

```bash
cd outputs/frontend
npm ci
npm test
npm run build
npm start
```

Abra http://localhost:4200. A API permanece em http://127.0.0.1:8000/api/v1. A migração 002 cria tabelas de idempotência, limite de login e bloqueio de gestão; não altera visitas ou usuários existentes. Ela não foi aplicada automaticamente ao banco em uso.

## Integração isolada opcional

No backend, com uma conta que possa criar/remover bancos no servidor:

```powershell
$env:TEST_DB_DATABASE = 'visitas_test_' + [Guid]::NewGuid().ToString('N')
php tests/mysql.php
Remove-Item Env:\TEST_DB_DATABASE
```

```bash
TEST_DB_DATABASE="visitas_test_$(date +%s)_${RANDOM}" php tests/mysql.php
```

O runner recusa bancos existentes e o nome do banco atual; cria/migra somente o novo banco e remove-o ao terminar. Não habilite integração antiga no banco de uso real.

## Mudanças

Idempotência por funcionário/chave com snapshot transacional; proteção contra respostas atrasadas; GPS com timestamp e prazo máximo de dois minutos; confirmação de criação; login limitado por origem/conta com 429/Retry-After; nomes nos detalhes; filtros com limites UTC; CRUD administrativo sem exclusão e proteção concorrente do último admin; avisos de saída; contagem Unicode uniforme.

Novos contratos: Idempotency-Key e gps_capturado_em obrigatórios no POST de visitas; filtros inicio/fim/status/empresa/funcionario_id; funcionario_nome/responsavel_nome; POST /usuarios e PATCH /usuarios/{id} exclusivos de admin. Detalhes nos [READMEs do backend](backend/README.md) e [frontend](frontend/README.md).

Validação: 36 testes Angular, 22 unitários PHP e 8 integrações reais em MariaDB 10.4.32. MySQL 8 não foi validado neste ambiente. A tentativa incerta fica em memória da tela; se abandoná-la, confira a listagem antes de cadastrar novamente. [Resultados e limites](frontend/VALIDACAO.md).
