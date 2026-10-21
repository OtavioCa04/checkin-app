@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Em campo - Criar administrador
call "%~dp0scripts\ferramentas.cmd" php
if errorlevel 1 goto falha
if not exist "backend\vendor\autoload.php" goto preparo
if not exist "backend\.env" goto preparo
echo Cria um NOVO administrador. Nao altera senhas de contas existentes.
echo Escolha uma senha de 12 a 72 caracteres (letras, numeros e simbolos como - ou _). Evite acentos e cedilha. A digitacao ficara oculta.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $name=Read-Host 'Seu nome'; $email=Read-Host 'E-mail que usara para entrar'; $secret=Read-Host 'Escolha sua senha' -AsSecureString; $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret); try { $env:SEED_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer); & php 'backend/bin/create-user.php' $name $email 'admin'; $code=$LASTEXITCODE } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); Remove-Item Env:SEED_PASSWORD -ErrorAction SilentlyContinue }; exit $code"
if errorlevel 1 goto falha
echo.
echo ADMINISTRADOR CRIADO. Guarde o e-mail e a senha que voce escolheu.
pause
exit /b 0
:preparo
echo Execute primeiro os passos 1 e 2 e configure backend\.env.
:falha
echo.
echo Nao foi possivel criar o administrador. Consulte o guia e o erro acima.
pause
exit /b 1
