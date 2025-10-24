#!/usr/bin/env bash
# Reemplaza referencias a raw.githubusercontent/github blob por rutas relativas
# Ejecutar desde la copia que Netlify clona (no modifica tu repo original)
set -e

echo "Reemplazando referencias raw.githubusercontent/github blob por rutas relativas..."

# Buscar y reemplazar en archivos html, js y css
find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' \) -print0 | \
  xargs -0 sed -i \
  -e "s|https://raw.githubusercontent.com/liqko/guia-local-dolores/main/|/|g" \
  -e "s|https://raw.githubusercontent.com/liqko/guia-local-dolores/master/|/|g" \
  -e "s|https://github.com/liqko/guia-local-dolores/blob/main/|/|g" \
  -e "s|https://github.com/liqko/guia-local-dolores/blob/master/|/|g" || true

echo "Reemplazos realizados."
