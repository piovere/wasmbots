#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"
cd ..

./scripts/_build_wasms.sh
./scripts/_validate_wasms.sh

pushd frontend
npm run build
popd

if [[ -f ./scripts/deploy_frontend.sh ]]; then
    ./scripts/deploy_frontend.sh
else
    echo "no deployment script found" >&2
    exit 1
fi
