@echo off
git add -A
git commit -m "feat: rename LumenDex to Pokedex, add custom app icon, rebuild portable exe"
git push
del "%~f0"
