# Publicar o Em campo na internet

Guia para colocar o sistema numa hospedagem compartilhada com PHP e MySQL (por exemplo, Hostinger nos planos com acesso SSH). O resultado são dois endereços com HTTPS:

| Endereço | O que fica lá |
|---|---|
| `https://app.seudominio.com.br` | A interface (arquivos do build do Angular) |
| `https://api.seudominio.com.br` | A API PHP (pasta `backend`, com o site apontando para `backend/public`) |

Troque `seudominio.com.br` pelo seu domínio em todos os exemplos. Os nomes dos menus mudam de uma hospedagem para outra: o guia diz **o que** configurar, não onde clicar.

## O que você precisa

- Hospedagem com **PHP 8.2 ou mais novo** (extensões `pdo_mysql` e `mbstring`), **MySQL ou MariaDB**, **acesso SSH** e certificado **SSL** (HTTPS).
- Dois subdomínios (`app` e `api`) no domínio.
- No seu computador: Node.js 20.19+, 22.12+ ou 24+ e npm, para gerar o build da interface.
- Composer: no servidor, ou no seu computador se o servidor não tiver.

## 1. Banco de dados

1. No painel da hospedagem, crie um banco MySQL e um usuário **só para ele**, com senha forte. Não use o usuário administrador do servidor.
2. Anote: host do banco (muitas vezes `localhost`), porta (normalmente `3306`), nome do banco, usuário e senha.

## 2. API (backend)

1. Envie a pasta `backend` para o servidor, por SSH/SFTP ou pelo gerenciador de arquivos. **Não envie** `backend/.env`, `backend/vendor`, `backend/storage/logs/*` nem `backend/storage/uploads/*` do seu computador.
2. Pelo SSH, dentro da pasta `backend`:

   ```sh
   composer install --no-dev --optimize-autoloader
   ```

   Sem Composer no servidor: rode o mesmo comando no seu computador e envie a pasta `vendor` gerada.
3. Crie o arquivo `backend/.env` no servidor (copie `.env.example` e ajuste):

   ```text
   APP_ENV=production
   CORS_ORIGINS=https://app.seudominio.com.br
   DB_HOST=localhost
   DB_PORT=3306
   DB_DATABASE=nome_do_banco
   DB_USERNAME=usuario_do_banco
   DB_PASSWORD="senha_do_banco"
   TOKEN_TTL_SECONDS=28800
   LOGIN_WINDOW_SECONDS=900
   LOGIN_IP_LIMIT=30
   LOGIN_ACCOUNT_LIMIT=10
   TRUSTED_PROXIES=
   ```

   - `CORS_ORIGINS` é o endereço exato da interface, com `https://` e sem barra no fim.
   - `TRUSTED_PROXIES` fica vazio, a não ser que a hospedagem ou um CDN (como Cloudflare) fique na frente do PHP. Nesse caso, informe os IPs do proxy. Sem isso, o limite de tentativas de login enxerga todos os usuários com o mesmo IP.
4. Crie as tabelas:

   ```sh
   php bin/migrate.php
   ```

   Devem aparecer as migrações `001` a `007`.
5. Crie o primeiro administrador. A senha é digitada sem aparecer na tela:

   ```sh
   read -s -p "Senha do admin: " SEED_PASSWORD && export SEED_PASSWORD
   php bin/create-user.php "Seu Nome" seu.email@seudominio.com.br admin
   unset SEED_PASSWORD
   ```

6. Garanta que o PHP consegue gravar em `backend/storage/logs` e `backend/storage/uploads` (permissão `755` nas pastas costuma bastar).
7. No painel, aponte o subdomínio `api` para a pasta **`backend/public`**.
   - Se o painel só aceitar pastas dentro de `public_html`, coloque a pasta `backend` lá dentro e aponte o subdomínio para `backend/public`. Os arquivos `backend/.htaccess` e `backend/public/.htaccess` bloqueiam tudo fora de `public`: `.env`, código, fotos e migrações respondem 403.
8. Fotos de até 5 MB: o arquivo `backend/public/.user.ini` já pede `upload_max_filesize = 8M` e `post_max_size = 10M`. Se a hospedagem ignorar esse arquivo, ajuste esses dois valores no painel do PHP.

Teste: `https://api.seudominio.com.br/api/v1/health` deve mostrar um JSON com `"status":"ok"`.

## 3. Interface (frontend)

1. No seu computador, dentro da pasta `frontend`:

   ```sh
   npm ci
   npm run build
   ```

2. Envie **todo o conteúdo** de `frontend/dist/visitas/browser` para a pasta do subdomínio `app`, incluindo os arquivos ocultos `.htaccess` e `config.js`. Alguns programas de FTP escondem arquivos que começam com ponto.
3. No servidor, edite `config.js` e coloque o endereço da API:

   ```js
   window.EM_CAMPO_CONFIG = { apiUrl: "https://api.seudominio.com.br/api/v1" };
   ```

   Não é preciso gerar o build de novo para trocar esse endereço.

## 4. HTTPS

Ative o SSL nos dois subdomínios e a opção de forçar HTTPS. O login e as fotos só devem trafegar com HTTPS.

## 5. Conferência antes de chamar o cliente

- [ ] `https://api.seudominio.com.br/api/v1/health` responde `"status":"ok"`.
- [ ] `https://api.seudominio.com.br/.env` e `https://app.seudominio.com.br/.env` **não** mostram nada (403 ou 404).
- [ ] O login do administrador funciona em `https://app.seudominio.com.br`.
- [ ] Abrir direto `https://app.seudominio.com.br/agenda` e recarregar a página leva ao login, sem erro 404.
- [ ] O admin cria um funcionário, um cliente e vincula os dois.
- [ ] O funcionário faz um check-in com local e foto **num celular Android e num iPhone de verdade**, e a foto aparece na visita.
- [ ] Concluir a visita com data de retorno cria a pendência em Retornos.

## Backup

Faça backup das duas coisas, sempre juntas:

1. O banco de dados (pelo painel ou `mysqldump`).
2. A pasta `backend/storage/uploads/visitas`, onde ficam as fotos. Sem ela, as visitas mostram que têm foto, mas a imagem não abre.

O `backend/.env` não vai para o backup compartilhado: guarde a senha do banco em local seguro.

## Atualizar o sistema depois

1. Faça backup do banco e das fotos.
2. Envie a nova pasta `backend` sem sobrescrever `backend/.env` nem `backend/storage`.
3. Rode `composer install --no-dev --optimize-autoloader` e `php bin/migrate.php`. O runner aplica só as migrações novas.
4. Gere o build novo da interface e envie o conteúdo de `dist/visitas/browser`. **Mantenha o `config.js` do servidor**, ou edite o novo com o endereço da API.
5. Avise os usuários para entrar de novo: o login fica só na memória do navegador.
