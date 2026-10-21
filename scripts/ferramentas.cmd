@echo off
rem Altera somente o ambiente desta janela, nunca o PATH do Windows.
if /I "%~1"=="node" goto node
if defined PHP_EXE (
  if not exist "%PHP_EXE%" goto php_faltando
  for %%P in ("%PHP_EXE%") do set "PATH=%%~dpP;%PATH%"
)
where php.exe >nul 2>nul
if errorlevel 1 (
  if exist "C:\xampp\php\php.exe" set "PATH=C:\xampp\php;%PATH%"
)
where php.exe >nul 2>nul
if errorlevel 1 goto php_faltando
php -r "exit(PHP_VERSION_ID>=80200 && PHP_INT_SIZE>=8 && extension_loaded('pdo_mysql') && extension_loaded('mbstring') ? 0 : 1);"
if errorlevel 1 (
  echo ERRO: use PHP 8.2 ou superior, 64 bits, com pdo_mysql e mbstring ativos.
  echo Consulte a parte de problemas comuns do LEIA-ME-PRIMEIRO.txt.
  exit /b 1
)
if /I "%~1"=="php" exit /b 0
:node
where node.exe >nul 2>nul
if errorlevel 1 goto node_faltando
where npm.cmd >nul 2>nul
if errorlevel 1 goto node_faltando
node -e "const [m,n]=process.versions.node.split('.').map(Number);process.exit((m===20&&n>=19)||(m===22&&n>=12)||m>=24?0:1)"
if errorlevel 1 (
  echo ERRO: a versao do Node.js e antiga. Instale Node.js 24 LTS.
  exit /b 1
)
if /I "%~1"=="node" exit /b 0
where composer >nul 2>nul
if errorlevel 1 (
  echo ERRO: Composer nao encontrado. Instale o Composer e abra esta janela de novo.
  exit /b 1
)
exit /b 0
:php_faltando
echo ERRO: PHP nao encontrado. Instale o XAMPP em C:\xampp ou configure PHP no PATH.
exit /b 1
:node_faltando
echo ERRO: Node.js/npm nao encontrado. Instale Node.js 24 LTS e abra esta janela de novo.
exit /b 1
