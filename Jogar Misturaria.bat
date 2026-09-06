@echo off
REM Dois cliques neste arquivo abrem o jogo Misturária
cd /d "%~dp0"
start "" http://localhost:4173
node servidor.mjs
pause
