#!/bin/bash
# Forge Flow - Vercel Ignored Build Step
# Only build if files changed AND commit has deployment flag
#
# Exit 0 = Skip build
# Exit 1 = Proceed with build

set -e

echo "🔍 Checking if build should proceed..."

# Get the current commit message
COMMIT_MSG=$(git log -1 --pretty=%B)
echo "📝 Commit message: $COMMIT_MSG"

# Check if commit message contains deployment flags
if [[ "$COMMIT_MSG" =~ \[deploy\]|\[vercel\]|\[preview\] ]]; then
  echo "✅ Deployment flag found in commit message"
  FLAG_FOUND=true
else
  echo "➠️  No deployment flag found ([deploy], [vercel], or [preview])"
  FLAG_FOUND=false
fi

# Check if any files changed in this project
if git diff HEAD^ HEAD --quiet .; then
  echo "⚠️  No files changed in chromasmith-sandbox"
  FILES_CHANGED=false
else
  echo "✅ Files changed in chromasmith-sandbox"
  FILES_CHANGED=true
fi

# Proceed with build only if BOTH conditions are true
if [ "$FLAG_FOUND" = true ] && [ "$FILES_CHANGED" = true ]; then
  echo "🚀 Both conditions met - PROCEEDING with build"
  exit 1  # Exit 1 = Proceed with build
else
  echo "🛑 Conditions not met - SKIPPING build"
  exit 0  # Exit 0 = Skip build
fi
