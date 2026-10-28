#!/usr/bin/env bash
# Installs a dedicated Node 22 runtime for tzbiz. Does not modify /usr/bin, apt sources,
# system PM2, other apps or any running process. Run explicitly as an operator.
set -euo pipefail
ROOT="${TZBIZ_NODE_ROOT:-/opt/tzbiz-node22}"
case "$ROOT" in /*) ;; *) echo 'TZBIZ_NODE_ROOT must be an absolute directory.' >&2; exit 1;; esac
if [[ "$ROOT" == / ]]; then echo 'Refusing filesystem root.' >&2; exit 1; fi
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || { echo 'This installer supports Linux x86_64 only.' >&2; exit 1; }
for command in curl sha256sum tar mktemp; do command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }; done
TEMP="$(mktemp -d)"
trap 'rm -rf -- "$TEMP"' EXIT
BASE='https://nodejs.org/dist/latest-v22.x'
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location "$BASE/SHASUMS256.txt" -o "$TEMP/SHASUMS256.txt"
ENTRY="$(awk '$2 ~ /^node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz$/ { print }' "$TEMP/SHASUMS256.txt")"
[[ "$(printf '%s\n' "$ENTRY" | wc -l)" == 1 && -n "$ENTRY" ]] || { echo 'Unexpected official release manifest.' >&2; exit 1; }
FILE="$(printf '%s\n' "$ENTRY" | awk '{ print $2 }')"
VERSION_DIR="${FILE%.tar.xz}"
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location "$BASE/$FILE" -o "$TEMP/$FILE"
printf '%s\n' "$ENTRY" > "$TEMP/selected.sha256"
(cd "$TEMP" && sha256sum --check selected.sha256)
mkdir -p "$ROOT"
if [[ -e "$ROOT/current" && ! -L "$ROOT/current" ]]; then echo "Refusing to replace a non-symlink $ROOT/current" >&2; exit 1; fi
if [[ ! -d "$ROOT/$VERSION_DIR" ]]; then
  tar -xJf "$TEMP/$FILE" -C "$TEMP"
  "$TEMP/$VERSION_DIR/bin/node" --version
  mv -- "$TEMP/$VERSION_DIR" "$ROOT/$VERSION_DIR"
fi
"$ROOT/$VERSION_DIR/bin/node" --version
ln -sfn -- "$VERSION_DIR" "$ROOT/current"
echo "Installed only in $ROOT/current. No application was restarted."
echo "For this shell: export PATH=\"$ROOT/current/bin:\$PATH\""
