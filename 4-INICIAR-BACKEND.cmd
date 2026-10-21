@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Em campo - Backend - NAO FECHE
call "%~dp0scripts\ferramentas.cmd" php
if errorlevel 1 goto falha
if not exist "backend\vendor\autoload.php" goto preparo
if not exist "backend\.env" goto preparo
set "CORS_ORIGINS=http://localhost:4200,http://localhost:4201,http://127.0.0.1:4201"
echo API local: http://127.0.0.1:8000/api/v1/health
echo Deixe esta janela aberta e execute 5-INICIAR-FRONTEND.cmd.
pushd "%~dp0backend"
php -d variables_order=EGPCS -S 127.0.0.1:8000 -t public public/index.php
popd
echo.
echo O backend foi encerrado. Se a porta estiver ocupada, consulte o guia.
pause
exit /b 0
:preparo
echo Execute os passos 1 e 2 e configure backend\.env antes de iniciar.
:falha
pause
exit /b 1
