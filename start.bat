@echo off
rem Lance le serveur AgentClass en arriere-plan et ouvre la salle dans le navigateur.
node "%~dp0bin\agentclass.mjs" open
if errorlevel 1 pause
timeout /t 3 >nul
