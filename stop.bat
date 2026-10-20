@echo off
rem Arrete le serveur AgentClass.
node "%~dp0bin\agentclass.mjs" stop
timeout /t 3 >nul
