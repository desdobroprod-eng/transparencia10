#!/bin/bash
# Atualização semanal do Portal Transparência Cultural — roda no Mac via launchd
# (segunda 08:00). A máquina local é a única que alcança a API de servidores do
# MA e o export de emendas (runners do GitHub tomam timeout), então é ela quem
# produz o dataset completo: contratos + cruzamentos + emendas.
#
# Fluxo: pull → coletor (com guardas de regressão) → explicador → commit → push.
# O push em frontend/public/data/** dispara o workflow "Deploy para GitHub
# Pages", que builda e publica — nenhum build local necessário.
#
# Carregar/descarregar o agendamento:
#   launchctl load  ~/Library/LaunchAgents/com.10dobro.transparencia10-semanal.plist
#   launchctl unload ~/Library/LaunchAgents/com.10dobro.transparencia10-semanal.plist
# Log: ~/Library/Logs/transparencia10-semanal.log

set -euo pipefail

export PATH="/Library/Frameworks/Python.framework/Versions/3.13/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/usuario/transparencia10"
LOG="$HOME/Library/Logs/transparencia10-semanal.log"

exec >>"$LOG" 2>&1
echo ""
echo "══════════════════════════════════════════════════════"
echo "[SEMANAL] início: $(date '+%Y-%m-%d %H:%M:%S')"

cd "$REPO"

git pull --rebase origin main

python3 collector/run.py
python3 collector/explicador.py

git add frontend/public/data/
if git diff --staged --quiet; then
  echo "[SEMANAL] sem mudanças nos dados — nada a publicar"
else
  git commit -m "data: atualização semanal local $(date '+%Y-%m-%d %H:%M')"
  git push origin main
  echo "[SEMANAL] dados publicados — deploy dispara automaticamente"
fi

echo "[SEMANAL] fim: $(date '+%Y-%m-%d %H:%M:%S')"
