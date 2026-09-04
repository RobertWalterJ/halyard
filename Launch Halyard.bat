@echo off
title Halyard
cd /d "%~dp0"
echo Starting Halyard...
start "" http://localhost:8790
node server.mjs
