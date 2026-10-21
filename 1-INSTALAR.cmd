@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Em campo - Instalar dependencias
echo INSTALACAO INICIAL - precisa de internet.
call "%~dp0scripts\ferramentas.cmd" todas
if errorlevel 1 goto falha
if /I "%~1"=="--verificar" (
  echo Ferramentas verificadas. Nenhum download ou alteracao no banco foi feito.
  exit /b 0
)
pushd "%~dp0backend"
call composer install --no-interaction --prefer-dist
if errorlevel 1 (
  popd
  goto falha
)
popd
pushd "%~dp0frontend"
call npm.cmd ci
if errorlevel 1 (
  popd
  goto falha
)
popd
echo.
echo INSTALACAO CONCLUIDA.
echo Agora configure o banco e o arquivo backend\.env conforme o guia.
echo Depois execute 2-PREPARAR-BANCO.cmd.
pause
exit /b 0
:falha
echo.
echo A instalacao nao foi concluida. Leia o erro acima e o guia.
pause
exit /b 1
