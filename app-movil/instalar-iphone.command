#!/bin/bash
# Prepara la app JAC Seguros para instalarla en tu iPhone con Xcode.
# Uso: abre Terminal, arrastra este archivo a la ventana y pulsa Enter.
set -e
cd "$(dirname "$0")"

echo ""
echo "=== JAC Seguros · preparando la app para iPhone ==="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Falta Node.js."
  echo "   Se abrirá nodejs.org: descarga el botón verde (LTS), instálalo y vuelve a correr esto."
  open "https://nodejs.org/es/download"
  exit 1
fi

if [ ! -d "/Applications/Xcode.app" ]; then
  echo "❌ Falta Xcode."
  echo "   Se abrirá la App Store: instala Xcode (es gratis y pesado, tarda un rato) y vuelve a correr esto."
  open "macappstore://apps.apple.com/app/xcode/id497799835"
  exit 1
fi

echo "1/4  Descargando componentes (la primera vez tarda unos minutos)…"
npm ci --no-audit --no-fund --loglevel=error

[ -f .env ] || cp .env.example .env

echo "2/4  Armando la app…"
npm run build --silent >/dev/null

echo "3/4  Preparando el proyecto de iPhone…"
npx cap sync ios >/dev/null

echo "4/4  Abriendo Xcode…"
npx cap open ios

echo ""
echo "✅ Listo. Sigue en Xcode con el Paso 2 de la guía (elegir tu cuenta y pulsar ▶)."
echo ""
