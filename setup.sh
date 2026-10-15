#!/usr/bin/env bash
# Substitute your personal GitHub + npm usernames into the scaffold.
#
#   ./setup.sh <github-username> <npm-username>
#
# npm scope == npm username for a personal account, so packages publish as
# @<npm-username>/poc-*. Both values are matched case-sensitively by npm:
# trusted publishing checks the repository owner/name, and provenance checks
# that package.json's `repository` URL matches where you publish from.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: $0 <github-username> <npm-username>" >&2
  exit 2
fi

GH_USER="$1"
NPM_USER="$2"

cd "$(dirname "$0")"

files=$(grep -rl -e '__GH_USER__' -e '__NPM_USER__' . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude=setup.sh)

if [ -z "$files" ]; then
  echo "nothing to substitute — already set up?"
  exit 0
fi

# shellcheck disable=SC2086
sed -i.bak \
  -e "s|__GH_USER__|${GH_USER}|g" \
  -e "s|__NPM_USER__|${NPM_USER}|g" \
  $files

find . -name '*.bak' -not -path './node_modules/*' -delete

echo "Substituted GitHub=${GH_USER} npm=${NPM_USER} in:"
echo "$files" | sed 's/^/  /'
echo
echo "Next: npm install && npm run build"
