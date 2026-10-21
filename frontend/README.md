# Em campo — Angular 21

## Rodada de validação — 21/10/2026

78 testes aprovados e build de produção executado. Para máquinas com pouca memória: `npm test -- --runner-config=vitest.serial.config.ts` (PowerShell: `npm.cmd test -- --runner-config=vitest.serial.config.ts`). A configuração mantém todos os testes e limita os processos concorrentes. Fluxo real no navegador com GPS simulado e limites em [VALIDACAO_E2E.md](../VALIDACAO_E2E.md). As contagens de etapas anteriores abaixo são históricas.

## Clientes, resultados e retornos — 16/10/2026

Menus **Clientes** e **Retornos** adicionados. Cadastros/contatos, situação e atribuição administrativa, histórico autorizado, seleção de cliente/contato na agenda/check-in, resultado obrigatório na conclusão e geração explícita de agenda de retorno. Formulários preservam sessão em memória, proteção de saída, permissões e idempotência.

Atualização: aplique a migração 004 no backend (`composer migrate`, sem substituir `.env`), depois `npm ci`, `npm test`, `npm run build` e `npm start` no frontend. Comandos completos para **PowerShell e Git Bash**, campos, limites e endpoints em [CLIENTES-E-RETORNOS.md](../CLIENTES-E-RETORNOS.md); resultados em [VALIDACAO.md](VALIDACAO.md). Datas de retorno representam dias YYYY-MM-DD e são exibidas sem conversão de fuso; horário da agenda continua UTC/local.

## Agenda de visitas — 15/10/2026

Nova tela **/agenda** no menu: dia, semana ou período livre; filtros de situação e funcionário (admin), agendar, reagendar, cancelar, histórico e início com GPS pelo check-in existente. Pendentes vencidos aparecem como atrasados. Realizados/cancelados não oferecem alterações.

Antes de iniciar, aplique a migração 003 no backend com `composer migrate`. Os comandos Windows/PowerShell e Git Bash abaixo continuam válidos: `npm ci`, `npm test`, `npm run build` e `npm start`. Preserve o `.env`. Políticas e contratos completos em [AGENDA.md](../AGENDA.md).

Arquivos novos: `src/app/pages/agenda.ts`, `agenda-dates.ts` e `agenda.spec.ts`; contratos/API, rotas, menu, cadastro e detalhes estendidos. Datas entram no fuso do dispositivo e são enviadas em UTC; IDs/GPS são números JSON. Token continua somente em memória. **53 testes aprovados e build de produção concluído**; sem teste manual autenticado com GPS real.

Frontend standalone/TypeScript com Signals, formulários reativos, login, início por perfil, visitas com filtros/paginação, cadastro GPS, detalhes/edição/conclusão, logout e gestão administrativa de usuários. Dados reais da API; mocks somente nos testes. Fotos/e-mails/relatórios fora do escopo.

## Instalação, atualização e execução

Node 20.19+, 22.12+ ou 24+, npm e backend em http://127.0.0.1:8000. Antes, execute composer install e composer migrate no backend para aplicar 002_reliability.sql. **Preserve o .env existente.** Não precisa de CLI global.

PowerShell, na raiz do projeto:

```powershell
Set-Location frontend
npm ci
npm test
npm run build
npm start
```

Git Bash:

```bash
cd frontend
npm ci
npm test
npm run build
npm start
```

Abra http://localhost:4200. Use dois terminais para back/front. Ctrl+C encerra cada servidor. Se PowerShell bloquear npm.ps1, use npm.cmd. NVM precisa de versão ativa compatível. Build: dist/visitas/browser; configure fallback para index.html em hospedagem estática.

URL em src/app/config.ts; servidor Angular usa localhost:4200 e chama PHP diretamente, sem proxy. HTTPS em produção; geolocalização exige contexto seguro (localhost permitido). Dependências mantidas, sem biblioteca nova; versões resolvidas em package-lock.json. Não há commit/push automático.

O processo escuta em 127.0.0.1 (IPv4), mas abra a interface por **http://localhost:4200**, origem permitida no CORS. O npm start desativa HMR e recarregamento automático para não apagar a sessão em memória durante alterações no código. Após uma atualização manual de código, recarregue deliberadamente e faça novo login.

O botão Registrar check-in é uma ação explícita com type=button; o envio nativo do formulário é cancelado. Enter em campos de uma linha registra/valida; Enter na descrição mantém a quebra de linha. O aviso de saída permanece apenas para fechamento/recarga/navegação deliberada com dados não salvos.

## Sessão e permissões

Token só em memória (Session), sem localStorage/sessionStorage/cookies. Interceptor envia Bearer exclusivamente à origem/caminho da API, withCredentials=false. 401 desta API limpa a sessão e leva ao login. Recarregar exige login; logout limpa memória mesmo se revogação falhar, informando a falha.

Funcionário vê suas visitas e cria. Responsável consulta atribuídas, sem edição. Admin vê todas, edita em andamento e gerencia usuários; não cria check-ins. Concluídas ficam somente leitura. Guards cuidam da navegação; backend continua aplicando todas as permissões.

Login consulta /auth/me após autenticar. 429 exibe Retry-After e bloqueia envio durante contagem regressiva. Backend precisa permitir CORS de localhost:4200, Idempotency-Key e leitura de Retry-After.

## Cadastro confiável e GPS

Contato (150), empresa (180), assunto (200), descrição (10000) obrigatórios. A contagem usa **pontos de código Unicode**, igual a mb_strlen UTF-8: emoji simples conta um, sequências combinadas podem contar vários. Sem maxlength nativo UTF-16. Senha continua em bytes UTF-8 (login até 72; criação de usuário 12–72).

Responsáveis vêm de GET /responsaveis (apenas ID/nome ativos); funcionário não acessa /usuarios. IDs/GPS são números JSON.

Captura explícita com alta precisão, timeout 15 segundos e maximumAge=0. Guarda gps_capturado_em original do navegador (milissegundos Unix), mostra hora/expiração e valida novamente no envio. GPS_CONFIG.maxAgeMs é configurável em config.ts, com teto 120000 ms; mantenha coerente com GPS_MAX_AGE_SECONDS do backend. O servidor também valida idade na criação. Check-in oficial continua no servidor; GPS não comprova presença física. Mensagens específicas para permissão negada, timeout, indisponibilidade e GPS vencido.

Cada tentativa lógica recebe crypto.randomUUID e snapshot. Falha de conexão/timeouts/5xx mantém chave e dados originais. **Recuperar tentativa original** repete exatamente a requisição. Alterar formulário/GPS não cria outra visita automaticamente; pede resolver a tentativa anterior e avisa que alterações posteriores não serão enviadas na recuperação.

Na recuperação, o backend devolve snapshot se houve commit; se não houve e a captura venceu, retorna 400 sem criar. Após erro definitivo, corrija dados/faça nova captura para nova tentativa. 409 não gera outra chave silenciosamente. Ao criar, a mensagem “Check-in registrado com sucesso” aparece nos detalhes uma única vez, depois é removida do histórico. Se a navegação falhar após sucesso, há link para a visita e novo envio é bloqueado.

A tentativa incerta fica em memória da tela: sair deliberadamente/recarregar pode perdê-la. Recupere antes de sair; se abandoná-la, confira a listagem antes de registrar outra visita. Sem fila offline ou rascunho persistente.

## Detalhes, filtros e avisos de saída

Detalhes exibem nomes atuais e IDs de funcionário/responsável e preservam o retrato cadastral. Edição envia campos textuais permitidos; conclusão envia status=concluida, resultado, resumo e, opcionalmente, próximo passo/dia de retorno. GPS, identidade, responsável, retratos e horários oficiais não são editáveis. 409 recarrega estado atual.

Carregamento/gravação têm identidade e geração. Respostas, erros, mensagens e finally antigos são ignorados após navegar/destruir a tela. **Sair não garante cancelar uma gravação no servidor.** Consulte o registro para confirmar.

Guards de saída avisam criação/edição e gestão de usuário com mudanças não salvas/operação em andamento. beforeunload tenta avisar fechamento/recarga quando o navegador permitir. Após salvar não avisa. Logout/401 limpam identidade e passam sem confirmação.

Filtros: início de check-in incluído, fim excluído, status, empresa contém; admin também filtra ID do funcionário. datetime-local usa o fuso do dispositivo e converte para UTC YYYY-MM-DDTHH:mm:ssZ. Respostas DATETIME são UTC e formatadas localmente pt-BR. Exemplo em UTC−3: 09h local = 12hZ.

Aplicar/limpar volta à primeira página. Filtros/offset estão na query string; detalhes/Voltar os preservam. Listagem ignora respostas de filtros antigos. Sem total no backend, uma última página cheia pode permitir avançar à vazia; volte com Anterior.

## Gestão administrativa

Criar usuário com senha inicial; editar nome/e-mail; ativar/inativar; alterar perfil. Sem exclusão física ou troca de senha por PATCH. Backend protege último admin ativo sob concorrência; UI exibe erros e 409. Alteração da própria conta atualiza sessão, sai da área administrativa ou encerra login conforme necessário.

Mudanças preservam visitas/IDs/vínculos; perfil **atual** controla o acesso. Nomes atuais aparecem nas visitas existentes. Política detalhada no [README do backend](../backend/README.md).

## Contratos e arquivos

Prefixo /api/v1: POST /auth/login; GET /auth/me; POST /auth/logout; GET /responsaveis; GET/POST /visitas; GET/PATCH /visitas/{id}; GET/POST /usuarios; PATCH /usuarios/{id}. Sucesso success/message/data; erro success/message/errors. Listas data.items/limit/offset.

- config.ts/models.ts: URL, limite GPS, contratos.
- session.ts/auth.ts: token, identidade, interceptor, guards.
- api.ts/shared.ts: HTTP, erros, Unicode, UTC, GPS.
- unsaved.ts: saída/beforeunload.
- pages/create.ts/detail.ts: idempotência, GPS, operações isoladas e confirmação.
- pages/lists.ts/users.ts/login.ts: filtros, usuários e cooldown.
- app.ts/routes.ts/styles.css: navegação e layout responsivo.
- *.spec.ts: testes de comportamento e contratos.

## Validação

Veja [VALIDACAO.md](VALIDACAO.md). Testes usam HttpTestingController, promises controladas para atraso e GPS simulado apenas nos spec. Integração concorrente real em backend/tests/mysql.php cria um banco novo dedicado, removido ao final.

No ambiente de validação foi usado Node 24.19.0 do runtime. TEMP/TMP foram apontados para work/test-temp, evitando restrições do sandbox no temporário do Windows. Não foi alterada a instalação do usuário. Em terminal normal, use npm test.

