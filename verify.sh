#!/usr/bin/env bash
# Prove a published version came from GitHub Actions via npm trusted publishing
# (OIDC) — not from a long-lived token.
#
#   ./verify.sh <pkg> <before-version> <after-version>
#   ./verify.sh @viraldam/poc-adapter-astro 0.1.0 0.2.0
#
# Why this exists: npm's OIDC code path is documented as "intended to never
# throw". A broken trusted-publisher config logs verbosely and falls back to
# token auth, so the workflow still goes green. Registry metadata is the only
# proof, and the SLSA attestation is the only *cryptographic* proof.
set -euo pipefail

PKG="${1:?usage: $0 <pkg> <before-version> <after-version>}"
BEFORE="${2:?}"
AFTER="${3:?}"
REG=https://registry.npmjs.org

need() { command -v "$1" >/dev/null || { echo "missing dependency: $1" >&2; exit 1; }; }
need jq
need curl

packument=$(curl -fsSL "$REG/$PKG")

publisher() {
  echo "$packument" | jq -r --arg v "$1" '
    .versions[$v] // empty
    | "  _npmUser.name : \(._npmUser.name // "<none>")"
    + "\n  trustedPublisher: \(if ._npmUser.trustedPublisher then (._npmUser.trustedPublisher|tostring) else "<absent>" end)"
    + "\n  attestations  : \(if .dist.attestations then "present" else "ABSENT" end)"'
}

echo "=== $PKG ==="
echo
echo "BEFORE ($BEFORE) — expect your own npm account, no attestations:"
publisher "$BEFORE"
echo
echo "AFTER ($AFTER) — expect name='GitHub Actions', trustedPublisher set, attestations present:"
publisher "$AFTER"
echo

# ---- the cryptographic check -------------------------------------------------
# Decode the SLSA provenance DSSE payload. This is signed, so unlike the fields
# above it cannot be spoofed by whoever published.
echo "SLSA provenance for $PKG@$AFTER:"
if att=$(curl -fsSL "$REG/-/npm/v1/attestations/$PKG@$AFTER" 2>/dev/null); then
  echo "$att" \
    | jq -r '.attestations[] | select(.predicateType | test("slsa")) | .bundle.dsseEnvelope.payload' \
    | base64 -d \
    | jq '{
        repository:  .predicate.buildDefinition.externalParameters.workflow.repository,
        workflow:    .predicate.buildDefinition.externalParameters.workflow.path,
        ref:         .predicate.buildDefinition.externalParameters.workflow.ref,
        event:       .predicate.buildDefinition.internalParameters.github.event_name,
        runner:      .predicate.runDetails.builder.id,
        invocation:  .predicate.runDetails.metadata.invocationId
      }'
else
  echo "  NO ATTESTATION (HTTP error) — the publish did NOT use trusted publishing," >&2
  echo "  or the repo/package is not public. This is the failure case." >&2
  exit 1
fi
echo

# ---- publish order ----------------------------------------------------------
# No atomic multi-package publish exists, so dependencies must land first.
echo "Publish timestamps (dependencies must precede dependents):"
echo "$packument" | jq -r --arg v "$AFTER" '.time[$v] | "  \($v): \(.)"'
echo

echo "Now run the consumer-side check in a scratch dir:"
echo "  mkdir -p /tmp/verify-install && cd /tmp/verify-install && npm init -y >/dev/null"
echo "  npm install $PKG@$AFTER && npm audit signatures"
