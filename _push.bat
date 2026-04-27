@echo off
git add -A
git commit -m "feat: animaux custom IDB, fix image manquante (Rainette), sidebar layout, importer vide par defaut"
git push
del "%~f0"
