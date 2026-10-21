# Em campo — Sistema de visitas

## Validação de 20–21/10/2026

Correções de sessão, busca Unicode, saída após cadastro e tabelas no celular; testes e comandos em [VALIDACAO_E2E.md](VALIDACAO_E2E.md). A rodada usa bancos descartáveis e preserva o `.env` e o banco atual. Os resultados de etapas anteriores são históricos.

**Primeira instalação, sem experiência com programação:** siga [LEIA-ME-PRIMEIRO.md](LEIA-ME-PRIMEIRO.md). O kit Windows inclui atalhos numerados para instalar e iniciar localmente na porta 4201.

API REST em PHP/MySQL e interface Angular para check-in com GPS, agenda, clientes/contatos, resultados, retornos e gestão de usuários.

- [Backend: instalação, configuração e endpoints](backend/README.md)
- [Frontend: instalação, execução e build](frontend/README.md)
- [Agenda: permissões, atualização e testes](AGENDA.md)
- [Clientes, contatos, resultados e retornos](CLIENTES-E-RETORNOS.md)

## Executar localmente

Pré-requisitos: PHP 8.2+ com PDO MySQL/mbstring, Composer, MySQL e Node compatível com Angular 21. Configure `backend/.env` a partir de `.env.example` somente na primeira instalação. Nunca substitua o `.env` existente em uma atualização.

Em um terminal:

```sh
cd backend
composer install
composer migrate
php -S 127.0.0.1:8000 -t public public/index.php
```

Em outro terminal:

```sh
cd frontend
npm ci
npm start
```

Abra http://localhost:4200. Crie sua conta administrativa com o comando descrito no README do backend. Não existem credenciais universais de acesso. O token fica apenas em memória e recarregar a página exige novo login.

Os comandos acima funcionam no PowerShell e no Git Bash. Se PowerShell bloquear `npm.ps1`, use `npm.cmd`. Instruções de testes e build estão nos READMEs de cada aplicação. Arquivos `.env`, dependências, logs e uploads privados são excluídos do versionamento.

