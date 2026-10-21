# Clientes e retornos — 16/10/2026

- 76 testes aprovados em 7 arquivos: 53 da base/agenda e 23 novos de clientes, contatos, CNPJ, calendário, seleção com IDs, conclusão com resultado, compatibilidade com concluídas antigas, filtros/volta, permissões da interface, retornos, confirmações e erros HTTP.
- Contrato de conclusão anterior adaptado para incluir resultado e resumo obrigatórios. O teste de resposta tardia continua cobrindo conclusão após navegação.
- Testes novos encontraram recarregamento indevido por dependências de signals na carga de cliente; corrigido com rastreamento apenas do ID. Respostas antigas de contatos/histórico não alteram novo registro. Os testes de UI aguardam a conclusão das promises HTTP antes de verificar o DOM.
- Build Angular de produção concluído, sem dependência nova. jsdom/HttpTestingController; integração real de banco no backend, com 22 testes aprovados.
- Sem teste manual autenticado em navegador/dispositivo com GPS real, MySQL 8 nativo ou teste de carga.
- Para teste local nesta sessão, 4200 já respondia com outro sistema. Esta aplicação foi iniciada em http://127.0.0.1:4201, com CORS correspondente apenas no ambiente do processo PHP (8000), sem alterar `.env` ou interromper o outro sistema.
- Sem commit/push. Detalhes e comandos em [CLIENTES-E-RETORNOS.md](../CLIENTES-E-RETORNOS.md). Registros abaixo são históricos.

# Agenda — 15/10/2026

Validação atual: 53 testes aprovados em 6 arquivos e build de produção Angular concluído. Inclui os 40 testes anteriores e 13 novos de agenda (datas, formulários, permissões, filtros e início com vínculo/GPS). jsdom/HttpTestingController; GPS real em navegador autenticado não testado manualmente. Detalhes em [AGENDA.md](../AGENDA.md). Registros abaixo são históricos.

# Validação da revisão — 14/10/2026

## Correção do envio pelos botões

Após relato de alerta de saída persistente, o botão de cadastro passou a type=button com ação explícita e preventDefault. O formulário também cancela submit nativo; teste adicional cobre Enter em campo simples e preservação de quebra de linha em textarea. **40 testes Angular passaram e o build de produção passou.** O servidor foi reiniciado sem HMR/live reload, com bind IPv4 para permitir acesso pelo navegador embutido via localhost:4200. A gravação real autenticada pelo navegador ainda depende do teste do usuário; os novos casos usam HTTP simulado, sem criar registros no banco em uso.

O formulário de cadastro e o de edição não tinham [formGroup] no elemento form. Os eventos ngSubmit não eram emitidos por uma diretiva Angular nesse elemento, permitindo submissão nativa/recarregamento em vez da chamada à API. Ambos foram vinculados ao grupo reativo.

A suíte atual passou com **39 testes**, em cinco arquivos, e o build de produção passou. Três casos novos em submit.spec.ts verificam clique no botão de cadastro com POST/chave de idempotência, validação sem GPS sem navegar/recarregar e clique no botão de edição com PATCH. Os eventos de submit tiveram defaultPrevented=true; navegação aos detalhes ocorreu apenas após resposta de sucesso da API simulada. Nenhuma visita foi criada no banco em uso por esses testes. O servidor Angular ativo recebeu a atualização automaticamente.

## Resultados da revisão anterior

- **36 testes Angular passaram**, 0 falhas, em quatro arquivos. Incluem os 20 testes anteriores e novos casos de GPS expirado, Unicode/emojis, repetição com chave/snapshot, alteração de formulário após falha, sucesso/erro/carregamento atrasado, confirmação de criação, cooldown 429, guards/beforeunload, navegação real entre visitas, filtros preservados e gestão de usuários.
- O build de produção passou após as correções: bundle inicial 317,29 kB (84,90 kB estimados para transferência), dentro do orçamento. Veja também a documentação do backend para a migração obrigatória 002_reliability.sql.
- **22 testes unitários PHP passaram**, 0 falhas.
- **8 testes de integração passaram** no servidor disponível **MariaDB 10.4.32**, utilizando PDO MySQL e bancos NOVOS com prefixo visitas_test_. Migrações 001 e 002 foram aplicadas somente nesses bancos, removidos ao final. Nenhum registro do banco atual foi usado ou alterado pelos testes.
- Concorrência real: workers PHP com conexões independentes verificaram mesma chave/mesmos dados, mesma chave/dados diferentes, rate limiting e desativação simultânea de administradores.
- Sintaxe: 32 arquivos PHP do projeto (fora de vendor), nenhum erro.
- O .env permaneceu com o mesmo SHA-256 registrado durante a revisão; 001_initial.sql permaneceu sem edição. Não houve commit/push.

## Limites da validação

Não foi executada a suíte em um servidor **MySQL 8**, pois o servidor local disponível é MariaDB 10.4.32. Os testes concorrentes reais não foram substituídos por SQLite ou mocks, mas os resultados não confirmam diferenças específicas do MySQL 8. O runner exibe a versão real e pode ser usado em um servidor MySQL dedicado com permissão CREATE/DROP DATABASE.

Não houve teste manual de navegador com credenciais/dados reais nesta revisão, nem migração aplicada ao banco em uso. A validação de rotas/formulários foi realizada pelo TestBed, HttpTestingController e RouterTestingHarness. Execute a atualização descrita nos READMEs antes de usar a nova API.

O sandbox inicialmente bloqueou sockets locais; após permissão de rede, a integração conectou e passou. TEMP/TMP do processo Angular foram apontados para work/test-temp para evitar bloqueio de renomeação no temporário padrão. Node 24.19.0 e PHP 8.5.10 foram usados, com extensões mbstring/pdo_mysql compatíveis. Nenhuma configuração do sistema foi alterada.
