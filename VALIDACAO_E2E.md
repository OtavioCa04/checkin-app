# Validação do sistema — 20 e 21/10/2026

Esta rodada corrigiu defeitos existentes, sem adicionar funcionalidades de negócio. Os testes automatizados, a inspeção de código e a integração no navegador estão separados abaixo. Uma aprovação nesta lista vale para o cenário descrito, não para todas as combinações possíveis.

## Ambiente e isolamento

| Item | Ambiente utilizado |
|---|---|
| Sistema | Windows / PowerShell |
| PHP | 8.5.11, `pdo_mysql`, `mbstring`, PDO com prepares nativos |
| Banco real dos testes | MariaDB 10.4.32, InnoDB, utf8mb4, sessão UTC |
| Node | 24.19.0 |
| Frontend | Angular 21.2.25, TypeScript 5.9, Vitest 4.1.11 / jsdom |
| Fuso de apresentação | America/Sao_Paulo |
| Navegador | Navegador integrado Chromium, interface real Angular |
| Larguras verificadas | 1280 × 900 e 390 × 844 |

O serviço MySQL habitual estava indisponível na primeira tentativa. Foi criada uma **instância separada** do MariaDB, com arquivos em `work/audit-mariadb`, ouvindo somente em `127.0.0.1:3308`. Nenhuma migração, fixture, alteração de senha, limpeza ou restauração foi executada no banco de uso do sistema. O `.env` original foi preservado; seu SHA-256 permaneceu `610C59E835210E2756F119E8AA191A7B2E088E4385DF46F86B2C0B1FE307315B`.

Cada suíte usa um nome novo `visitas_test_*`, recusa o nome configurado da aplicação e recusa um banco já existente. A exclusão automática ocorre somente quando aquela execução criou o banco. Não foram feitos commit ou push. Alterações locais das etapas anteriores foram mantidas. Não houve migração nova nesta rodada.

Ao terminar, a instância descartável da porta 3308 foi encerrada. As fixtures de navegador permanecem apenas nos arquivos dessa instância em `work`, para eventual inspeção; não são dados do banco habitual. Os bancos automáticos e de restauração foram removidos pelas próprias suítes.

## Defeitos encontrados e corrigidos

| Defeito reproduzido | Correção | Regressão / evidência |
|---|---|---|
| Um 401 atrasado de uma sessão anterior encerrava um novo login | O interceptor confere se o token atual ainda é o token da requisição que falhou | Novo teste em `frontend/src/app/auth.spec.ts`: falhou antes e passou depois |
| Busca de clientes com acentos/emoji podia gerar erro SQL, pela comparação com CNPJ em ASCII | A expressão de busca do CNPJ converte explicitamente para utf8mb4, preservando parâmetros preparados e escopo | Teste com segundo responsável reproduziu PDOException; depois passou. HTTP real confirmou buscas Unicode positivas/negativas e busca por CNPJ |
| Criar cliente mostrava aviso de sair com operação em andamento, mesmo após o INSERT ter terminado | O estado de gravação termina antes da navegação automática, com formulário já limpo | Reproduzido no navegador. Regressão testa o estado **durante** a navegação. Novo cliente criado após correção abriu seus detalhes sem aviso |
| Tabelas espremiam nomes/e-mails em fragmentos quase verticais no celular | Largura mínima dentro do contêiner de rolagem; tabela administrativa com região nomeada e foco | Reteste visual em 390 px; rolagem por seta no teclado, foco com contorno sólido e sem transbordamento da página |

Arquivos de produção alterados nesta rodada: `backend/src/Repositories/ClienteRepository.php`, `frontend/src/app/auth.ts`, `frontend/src/app/pages/clients.ts`, `frontend/src/app/pages/users.ts` e `frontend/src/styles.css`.

## Revisão estática — separada dos testes

Foram lidos READMEs, rotas, controllers, services, repositories/modelos envolvidos, migrações 001–004 e testes existentes. Foram conferidos o caminho Controller → Service → Repository/PDO, validação de identidade, escopos por proprietário/responsável, bloqueios transacionais, restrições únicas, snapshots, geração de retornos, autoload e tratamento central de erros. No frontend foram conferidos configuração da API, interceptor, sessão, guards, submissão, estados assíncronos e navegação dos cadastros/visitas/agenda/retornos. Essa leitura orientou os testes e as correções; não foi contabilizada como integração aprovada ou auditoria de segurança exaustiva.

## Resultados executados

| Verificação | Resultado final | Natureza |
|---|---|---|
| Backend `tests/run.php`, `RUN_DB_TESTS=0` | 33 aprovados, 0 falhas | Unitários; não prova conexão real |
| Backend `tests/mysql.php` | 25 aprovados, 0 falhas | Banco real, services/repositories e processos concorrentes com conexões independentes |
| Backend `tests/http.php`, incluindo backup | 13 aprovados, 0 falhas | Requisições HTTP reais → PHP → PDO → banco descartável |
| Angular, 7 arquivos de testes | 78 aprovados, 0 falhas | Componentes/guards/formulários, HTTP e GPS simulados, jsdom |
| Build Angular de produção | Aprovado; bundle inicial ~322 kB | Compilação real |
| Sintaxe PHP | 52 arquivos fora de vendor aprovados, 0 falhas | `php -l` |
| Fixture de navegador | Executada com sucesso | Banco novo com 2 administradores, 2 funcionários e 2 responsáveis fictícios |
| Navegador + API + banco | Fluxo funcional descrito abaixo executado | Integração real, **somente posição GPS simulada** |

Houve falhas intermediárias: testes de regressão dos defeitos acima, conexão 2002 com serviço indisponível e execução paralela do Vitest encerrada por falta de memória. O teste de fronteira de data inicialmente tentou mover o check-in para depois de um checkout já gravado; a restrição do banco impediu corretamente essa fixture inválida. A fixture foi corrigida para mover ambos os horários de forma consistente. As suítes afetadas foram repetidas. A execução final usa `vitest.serial.config.ts`, sem reduzir asserções ou retirar arquivos de teste.

### Integração real de banco e concorrência

A suíte existente foi preservada e ampliada. Foram executados:

- Idempotência de check-in: mesma chave/dados em paralelo resulta em uma visita e um mesmo ID; mesma chave com dados diferentes conflita; repetição devolve o snapshot original mesmo após edição ou expiração do GPS.
- Dois check-ins com chaves diferentes para uma agenda: somente um vínculo; cancelamento concorrente com início mantém estado e vínculo consistentes. Falha induzida por trigger confirma rollback do check-in e do estado da agenda.
- Dois agendamentos gerados simultaneamente pelo mesmo retorno: um único vínculo. Divergência de horário conflita; repetição da mesma solicitação recupera a agenda existente.
- Duas conclusões concorrentes da mesma visita: respostas 200/409, um checkout e **um retorno**, conferidos no banco.
- Desativação concorrente de administradores e remoção concorrente do perfil admin: permanece pelo menos um administrador ativo. Tentativa sequencial de remover o último também é rejeitada.
- CNPJ único em criação concorrente; contatos concorrentes com mesmo e-mail/telefone permitidos e somente um principal ativo.
- Dois funcionários e dois responsáveis: leitura direta e listagens não revelam cliente, contatos, visitas, agendas ou retornos fora do escopo. Filtros administrativos não ampliam o acesso de outros perfis.
- Cliente/contato inativos, contato de outro cliente, concessão e retirada de acesso, snapshots após renomear cliente/contato, histórico com escopo, agenda vinculada e textos legados sem cadastro.
- Resultado obrigatório, concluídas imutáveis, retorno realizado/cancelado, data sem horário e rollback conjunto de conclusão/checkout/retorno.

Os processos concorrentes chamam os serviços diretamente com conexões reais independentes. O servidor PHP embutido de HTTP não é usado como prova de paralelismo, pois atende de forma serial neste ambiente.

### Integração HTTP real

`tests/http.php` inicia seu próprio PHP em porta livre (padrão 8003), cria seis identidades fictícias e verifica os contratos públicos:

1. Login válido dos três perfis, login inválido, `/me`, ausência de hash nas respostas.
2. Cliente → contato → agenda → check-in com IDs e GPS numéricos, identidade autenticada e horário oficial UTC próximo do relógio do servidor.
3. Simulação de resposta perdida: a primeira resposta é desconsiderada e o mesmo pedido é reenviado; o ID e a contagem permanecem iguais. Chave divergente e segunda visita na mesma agenda são recusadas.
4. Troca direta de IDs, consultas/listagens e tentativa de alteração fora do escopo, usuários restritos a admin e filtro por funcionário restrito.
5. Edição, conclusão com resumo/próximo passo/retorno, bloqueio de reabertura, snapshot preservado após alteração cadastral, histórico e geração repetida de agenda pelo retorno.
6. Campos desconhecidos, espaços, limite com emoji, CNPJ inválido/duplicado, ID inexistente, `limit=101` e paginação real com `limit=1&offset=1`.
7. CORS de origem exata, preflight com Authorization/Idempotency-Key, origem externa sem liberação, 404 e 405.
8. Fixture em `02:59 UTC` entra no dia anterior de São Paulo; filtro termina em `03:00 UTC` com fim excluído. Campo de retorno mantém `YYYY-MM-DD`.
9. Usuário desativado com token, perfil alterado com token, expiração, logout e tentativa de reutilização.
10. Limite de login produz 429 e Retry-After positivo, exposto por CORS. Logs capturados do servidor de teste não contêm as senhas/tokens usados.

### Testes com mocks — não são E2E reais

Os 78 testes Angular usam HttpTestingController ou serviços/promessas controlados e incluem:

- Headers Bearer somente na origem/prefixo desta API; 401 externo não encerra sessão; sessão em memória; guards, logout e 401 com formulário sujo.
- Respostas tardias de leitura/gravação/erro de A não substituem B; recuperação de loading, falha de conexão e erro de API; cooldown de 429.
- Duplo envio, manutenção da chave e snapshot em resultado incerto, confirmação de criação uma única vez e submissão sem navegação nativa do formulário.
- GPS válido, negado, indisponível, timeout, falta de suporte, timestamp original, captura vencida e limites. **Esses testes não usam GPS físico.**
- Validação de formulários, Unicode, CNPJ, conclusão obrigatória, concluídas antigas sem resultado, permissões visuais, vínculos e retorno.
- UTC/local, limites de dia/semana, perto da meia-noite em America/Sao_Paulo e dia de retorno sem conversão. Filtros e parâmetros de volta nos fluxos cobertos.

### Navegador real

Foi usada uma cópia do frontend em `work/audit-frontend`, na porta 4202, apontando para o backend isolado em 8002. Somente o `index.html` dessa cópia recebeu um adaptador de geolocalização com posição fixa e timestamp atual. O frontend de produção **não recebeu esse adaptador**, e suas chamadas ao backend não foram mockadas. O `.env` não foi modificado.

Fluxo realizado como funcionário fictício:

1. Login e estado inicial vazio.
2. Cliente com acentos e emoji e contato principal.
3. Pesquisa real por `São Paulo` e emoji; vínculo do cadastro na agenda, responsável ativo e horário local 09:30.
4. Início pela agenda, campos vinculados bloqueados, captura simulada e registro do check-in; mensagem **“Check-in registrado com sucesso”**, permanecendo autenticado.
5. Edição da descrição e conclusão com resultado, próximo passo e dia de retorno.
6. Visita concluída sem editar/concluir; consulta do retorno e geração do agendamento #2; mensagem informa que o retorno continua pendente.
7. Histórico do cliente; endereço atual alterado, visita mantendo o endereço original no retrato; volta ao histórico preservando parâmetros.
8. Recarregamento levou ao login. Novo login e repetição do cadastro comprovaram a correção do aviso indevido. Logout de formulário alterado levou ao login sem bloqueio.

Também houve login real como responsável, com visita atribuída e ausência dos menus de check-in/usuários, e como administrador, com lista dos seis usuários. A matriz dos **dois** funcionários e **dois** responsáveis foi exercitada na API e no banco; não foram repetidas todas as combinações de tela para cada uma das seis contas.

No celular foram conferidos detalhes, retorno, formulários, navegação e tabela administrativa. Login foi enviado com Tab/Enter; botão focado apresentou contorno sólido. A região da tabela recebeu foco e rolou com a seta direita. A página não transbordou horizontalmente; tabelas e menu têm rolagem própria. Isso não substitui auditoria completa com leitor de tela.

Evidências com dados inteiramente fictícios:

- [Visita concluída no desktop](evidencias-e2e/visita-desktop.png)
- [Visita concluída no celular](evidencias-e2e/visita-celular.png)
- [Tabela administrativa no celular, com rolagem](evidencias-e2e/usuarios-celular.png)

## Backup e restauração executados

`tests/backup.php`, chamado pelo teste HTTP quando `MYSQL_BIN` está configurado, executou mysqldump com snapshot transacional e restaurou com mysql em **outro banco novo de teste**. Não usa `--databases`, não inclui criação do banco original e não passa senha na linha de comando.

Foram comparadas as **13 tabelas, 37 registros e 25 chaves estrangeiras**. Além das contagens, todas as linhas foram comparadas por representação canônica e hash; uma consulta conjunta confirmou o vínculo visita → retorno → agenda. O campo gerado de contato principal também foi restaurado. Dump e banco restaurado foram removidos após a verificação. Nenhum backup/restauração usou o banco atual.

## Como reproduzir

Dependências devem estar instaladas (`composer install`, `npm ci`). Use PHP com `pdo_mysql` e `mbstring`. Os comandos abaixo pressupõem `php`, `node`, `npm` e o cliente MariaDB/MySQL no PATH ou ajustados para a instalação local. A conta de teste precisa CREATE/DROP DATABASE e permissões de DDL/DML nos bancos descartáveis. Configure as variáveis **somente neste terminal**, apontando para a instância de teste. Não copie nem sobrescreva `.env`.

PowerShell, a partir da raiz do projeto:

```powershell
Set-Location backend
$env:RUN_DB_TESTS = '0'
php tests/run.php

# Exemplo da instância isolada usada nesta rodada; adapte à sua instância de testes.
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3308'
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = '' # somente a instância descartável local usada nesta rodada
$env:TEST_DB_DATABASE = 'visitas_test_' + [Guid]::NewGuid().ToString('N')
php -d variables_order=EGPCS tests/mysql.php

$env:TEST_DB_DATABASE = 'visitas_test_' + [Guid]::NewGuid().ToString('N')
$env:TEST_HTTP_PORT = '8003' # precisa estar livre; não encerra um servidor existente
$env:MYSQL_BIN = 'C:/xampp/mysql/bin'
php -d variables_order=EGPCS tests/http.php
if ($LASTEXITCODE -ne 0) { throw 'Integração HTTP falhou' }

Set-Location ../frontend
$env:TZ = 'America/Sao_Paulo'
npm.cmd test -- --runner-config=vitest.serial.config.ts
if ($LASTEXITCODE -ne 0) { throw 'Testes Angular falharam' }
npm.cmd run build
```

Git Bash, partindo da raiz:

```bash
cd backend
RUN_DB_TESTS=0 php tests/run.php
export DB_HOST=127.0.0.1 DB_PORT=3308 DB_USERNAME=root DB_PASSWORD=''
TEST_DB_DATABASE="visitas_test_$(date +%s)_${RANDOM}" \
  php -d variables_order=EGPCS tests/mysql.php
MYSQL_BIN='C:/xampp/mysql/bin' TEST_HTTP_PORT=8003 \
  TEST_DB_DATABASE="visitas_test_$(date +%s)_${RANDOM}" \
  php -d variables_order=EGPCS tests/http.php
cd ../frontend
TZ=America/Sao_Paulo npm test -- --runner-config=vitest.serial.config.ts
npm run build
```

`variables_order=EGPCS` permite que os processos PHP filhos recebam os overrides de teste antes do dotenv imutável. Não use `RUN_DB_TESTS=1` contra o banco da aplicação. As suítes novas já criam/migram seus próprios bancos. Feche o terminal ao terminar para descartar os overrides.

Neste ambiente foram usados os executáveis `C:/php85/php.exe` e Node em `C:/Users/NOT-28/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`. Para o Angular, esse diretório foi adicionado ao PATH. TEMP/TMP apontaram para `work/test-temp` quando necessário. A instância separada foi inicializada com `mysql_install_db.exe --datadir=<pasta nova em work> --port=3308` e iniciada usando o `my.ini` gerado, com `--bind-address=127.0.0.1`. Não aponte esse comando para o diretório de dados habitual.

### Preparar novas contas para uma repetição manual

`backend/tests/browser-fixture.php` cria outro banco novo e seis contas `audit1@example.test` a `audit6@example.test`: dois admins, dois funcionários e dois responsáveis, nessa ordem. Exige `TEST_DB_DATABASE` e `TEST_BROWSER_PASSWORD` fictícia de 12–72 bytes definida pelo operador; não exibe a senha. O banco fica mantido para a sessão manual, diferentemente das suítes automáticas.

```powershell
# No terminal de testes em backend, com DB_HOST/PORT/USERNAME/PASSWORD de teste.
$env:TEST_DB_DATABASE = 'visitas_test_browser_' + [Guid]::NewGuid().ToString('N')
$env:TEST_BROWSER_PASSWORD = Read-Host 'Defina uma senha fictícia somente para os testes'
php -d variables_order=EGPCS tests/browser-fixture.php
Remove-Item Env:TEST_BROWSER_PASSWORD
# Somente após preparação bem-sucedida:
$env:DB_DATABASE = $env:TEST_DB_DATABASE
$env:CORS_ORIGINS = 'http://localhost:4202'
php -d variables_order=EGPCS -S 127.0.0.1:8002 -t public public/index.php
```

Use uma **cópia** do frontend com `src/app/config.ts` apontando para `http://127.0.0.1:8002/api/v1` e inicie essa cópia com `npm start -- --port 4202`. Para repetir sem GPS físico, aplique o simulador apenas nessa cópia de testes ou use ferramentas de simulação do navegador. Depois da sessão, encerre os dois servidores e remova somente o banco descartável cujo nome foi criado para ela. Não use os lançadores de migração da aplicação com configurações de produção.

## Limites e verificações ainda necessárias

| Cenário | Situação / próximo teste |
|---|---|
| MySQL 8 nativo | Não executado; o banco real desta rodada é MariaDB 10.4.32. Repetir suítes no MySQL suportado antes da implantação |
| GPS físico, presença real, aparelho móvel | Não executados. A posição foi simulada, inclusive no navegador; testar permissões e sensores em aparelhos reais |
| Safari, Firefox e leitores de tela | Não executados. Houve Chromium, largura móvel simulada e verificação pontual de teclado/labels |
| Rede física offline/lenta, 500 e sessão expirada durante navegação no navegador real | Cobertura automatizada por mocks/promessas para a interface e expiração real na API; não houve matriz completa desses defeitos de rede no navegador real |
| Todos os diálogos em celular | Verificações pontuais; o mecanismo de automação pode finalizar um diálogo durante timeout de clique. Cancelar explicitamente cada confirmação deve ser repetido manualmente; guard foi testado de forma determinística no Angular |
| Volume, carga sustentada e todas as páginas da UI | Não executados. Paginação SQL/HTTP e parâmetros de navegação foram testados; a fixture visual contém poucos registros |
| Legado real do banco de uso | Não acessado para testes. Compatibilidade coberta por fixtures textuais antigas e concluídas sem resultado; validar uma cópia anonimizada de legado, sem alterar o banco atual |
| Idempotência de toda criação do sistema | A garantia existente cobre check-in e agenda gerada por retorno. Formulários bloqueiam duplo clique; criar cliente/contato/agenda comum não tem contrato geral de idempotência após perda de resposta. Não repetir cegamente esses POSTs |
| Logs de proxies/servidor de produção | Não acessados. Teste verificou logs capturados do PHP de teste; revisão estática confirmou log de exceção sem corpo/token/SQL. Verificar configuração do proxy antes de publicar |
| Implantação, HTTPS, recuperação de desastre de produção | Não executados; restauração foi validada somente entre bancos descartáveis |

Não há teste final reprovado sem correção na cobertura automatizada executada. Os itens não executados acima permanecem pendentes; não foram classificados como aprovados.
