# Agenda — 15/10/2026

Validação atual: 26 testes unitários e 13 testes de integração em MariaDB 10.4.32 aprovados; sintaxe PHP verificada. Inclui novas permissões, datas UTC, cancelamento/auditoria, rollback e concorrência ao iniciar visita. Banco temporário de integração criado e removido. Migração 003 aplicada ao banco local com conteúdo anterior preservado; `.env` inalterado. MySQL 8 nativo e teste manual com GPS real não executados. Detalhes em [AGENDA.md](../AGENDA.md). Registros abaixo são históricos.

# Histórico de validação do backend

- Diretório inicial inspecionado: sem código existente; implementação criada em outputs/backend.
- PHP localizado em C:/xampp/php/php.exe: 8.5.10.
- php.ini instalado aponta para extensões incompatíveis. Para os checks, foi usado `-n -d extension_dir=C:/php/ext -d extension=mbstring -d extension=pdo_mysql`, sem modificar o sistema.
- Testes unitários: 13 passaram, 0 falharam.
- Sintaxe: 24 arquivos PHP verificados com php -n -l; 0 falhas.
- Integração MySQL não executada: não há servidor/cliente MySQL disponível nos locais verificados, nem configuração de banco fornecida. O caso de integração está implementado e habilitável com RUN_DB_TESTS=1.
- Composer não está disponível no PATH ou no diretório padrão do instalador verificado. Não foi possível executar composer install ou gerar composer.lock; dependências não foram simuladas.
- A validação completa de login e criação por HTTP depende de instalar as dependências e fornecer um MySQL migrado. Os resultados unitários não comprovam essa integração.

## Validação durante a implementação do frontend

- O backend existente respondeu HTTP 200 em /api/v1/health.
- Foi adicionada GET /api/v1/responsaveis; a chamada real sem token retornou 401.
- Preflight CORS de localhost:4200 retornou 204 com a origem permitida.
- 15 testes PHP passaram, 0 falharam; os dois novos casos verificam os campos mínimos e as permissões do endpoint, usando dobles PDO.
- A sintaxe de todos os arquivos PHP do projeto (fora de vendor) foi verificada sem falhas.
- A integração com fixtures de escrita ficou desabilitada para preservar dados existentes. Nenhum .env ou registro do banco foi alterado.

## Revisão de confiabilidade — 14/10/2026

- 22 testes unitários PHP passaram, 0 falhas.
- 8 testes de integração passaram no servidor disponível MariaDB 10.4.32, com PDO MySQL. Workers com conexões independentes validaram idempotência simultânea (payload igual e conflitante), limite de login e manutenção de um administrador ativo sob concorrência.
- Cada execução criou um banco NOVO com prefixo visitas_test_, aplicou 001/002 somente nele e o removeu ao finalizar. Nenhuma migração ou fixture foi aplicada no banco em uso.
- 32 arquivos PHP fora de vendor passaram na verificação de sintaxe.
- MySQL 8 não foi validado: a instalação local disponível é MariaDB 10.4.32. O runner informa a versão e pode ser executado em outro servidor de teste MySQL.
- Frontend: 36 testes passaram e build Angular de produção aprovado (317,29 kB iniciais; 84,90 kB estimados para transferência).
- SHA-256 do .env permaneceu idêntico ao registrado na revisão; 001_initial.sql não foi editada. Nenhum commit/push foi feito.
- Comandos e contratos atualizados nos READMEs e em ../ATUALIZACAO.md. A migração 002 é obrigatória antes de usar a nova versão.
