# Em campo — Sistema de visitas

API REST em PHP/MySQL e interface Angular para check-in com GPS, acompanhamento de visitas, agenda e gestão de usuários.

- [Backend: instalação, configuração e endpoints](backend/README.md)
- [Frontend: instalação, execução e build](frontend/README.md)
- [Agenda: permissões, atualização e testes](AGENDA.md)

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
