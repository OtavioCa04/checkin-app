@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Em campo - Frontend - NAO FECHE
call "%~dp0scripts\ferramentas.cmd" node
if errorlevel 1 goto falha
if not exist "frontend\node_modules\@angular\cli\bin\ng.js" (
  echo Execute primeiro 1-INSTALAR.cmd.
  goto falha
)
echo Aguarde a compilacao. Depois abra http://127.0.0.1:4201 no navegador.
echo Deixe esta janela aberta enquanto estiver usando o sistema.
pushd "%~dp0frontend"
call npm.cmd start -- --port 4201
popd
echo.
echo O frontend foi encerrado. Se a porta estiver ocupada, consulte o guia.
pause
exit /b 0
:falha
pause
exit /b 1
