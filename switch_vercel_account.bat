@echo off
title Troca Rapida de Contas Vercel
echo ========================================================
echo        TROCA RAPIDA DE CONTAS VERCEL
echo ========================================================
echo.
echo Escolha qual conta voce deseja logar no terminal:
echo.
echo 1) Conta Principal (cryptonarquia@gmail.com)
echo 2) Ambiente de Teste (launchpad.2024@gmail.com)
echo 3) Fazer apenas logout
echo.
set /p choice=Digite o numero da opcao (1, 2 ou 3): 

if "%choice%"=="1" goto conta1
if "%choice%"=="2" goto conta2
if "%choice%"=="3" goto logout
echo.
echo Opcao invalida! Saindo...
goto end

:conta1
echo.
echo [1/2] Deslogando da conta atual...
call npx vercel logout
echo.
echo [2/2] Iniciando login com cryptonarquia@gmail.com...
call npx vercel login cryptonarquia@gmail.com
goto end

:conta2
echo.
echo [1/2] Deslogando da conta atual...
call npx vercel logout
echo.
echo [2/2] Iniciando login com launchpad.2024@gmail.com...
call npx vercel login launchpad.2024@gmail.com
goto end

:logout
echo.
echo Deslogando da conta atual...
call npx vercel logout
goto end

:end
echo.
echo Operacao concluida! 
echo Agora voce pode rodar 'npx vercel --prod' com seguranca.
echo.
pause
