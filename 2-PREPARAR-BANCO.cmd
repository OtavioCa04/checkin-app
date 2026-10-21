@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Em campo - Preparar banco
call "%~dp0scripts\ferramentas.cmd" php
if errorlevel 1 goto falha
if not exist "backend\vendor\autoload.php" (
  echo Execute primeiro 1-INSTALAR.cmd.
  goto falha
)
if not exist "backend\.env" (
  echo Crie e configure backend\.env conforme o LEIA-ME-PRIMEIRO.txt.
  goto falha
)
echo Ligue o MySQL no painel do XAMPP antes de continuar.
echo Este passo cria as tabelas pendentes no banco indicado em backend\.env.
echo Nunca use um banco de outro sistema. Nao apaga nem recria tabelas existentes.
pause
pushd "%~dp0backend"
php bin\migrate.php
if errorlevel 1 (
  popd
  goto falha
)
popd
echo.
echo BANCO PREPARADO. Se nenhuma migracao apareceu, as tabelas ja estavam atualizadas.
echo Na primeira instalacao, execute 3-CRIAR-ADMIN.cmd uma unica vez.
pause
exit /b 0
:falha
echo.
echo O banco nao foi preparado. Consulte o erro e o guia; nao apague os dados.
pause
exit /b 1
