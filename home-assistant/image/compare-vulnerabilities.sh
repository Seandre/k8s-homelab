#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: $0 BASE_REPORT IMAGE_REPORT" >&2
  exit 64
fi

BASE_REPORT=$1
IMAGE_REPORT=$2

test -f "$BASE_REPORT"
test -f "$IMAGE_REPORT"
command -v jq >/dev/null 2>&1

WORK_DIRECTORY=$(mktemp -d "${TMPDIR:-/tmp}/ha-vulnerability-policy.XXXXXX")
cleanup() {
  rm -rf "$WORK_DIRECTORY"
}
trap cleanup EXIT HUP INT TERM

normalize_report() {
  jq -r '
    .Results[]?.Vulnerabilities[]?
    | select(.Severity == "HIGH" or .Severity == "CRITICAL")
    | [.VulnerabilityID, .PkgName, .InstalledVersion, .Severity]
    | @tsv
  ' "$1" | sort -u
}

normalize_report "$BASE_REPORT" > "$WORK_DIRECTORY/base.tsv"
normalize_report "$IMAGE_REPORT" > "$WORK_DIRECTORY/image.tsv"
comm -13 "$WORK_DIRECTORY/base.tsv" "$WORK_DIRECTORY/image.tsv" \
  > "$WORK_DIRECTORY/new.tsv"

BASE_COUNT=$(wc -l < "$WORK_DIRECTORY/base.tsv" | tr -d ' ')
IMAGE_COUNT=$(wc -l < "$WORK_DIRECTORY/image.tsv" | tr -d ' ')

if [ -s "$WORK_DIRECTORY/new.tsv" ]; then
  echo "derived image introduces HIGH/CRITICAL vulnerabilities:" >&2
  cat "$WORK_DIRECTORY/new.tsv" >&2
  exit 1
fi

echo "vulnerability delta policy passed: base=$BASE_COUNT derived=$IMAGE_COUNT new=0"

