# Contributing

Thanks for improving the bridge.

## Before opening a change

1. Keep configuration, tokens, Agent Cards with credentials, and state files out
   of commits.
2. Capture a material product or architecture change under `docs/proposal/`.
   Accepted decisions require an ADR and matching architecture update.
3. Keep runtime behavior covered by a focused test.

## Local checks

```sh
bun install
bun run format
bun run typecheck
bun test
bun run build
docker compose config -q
```

## Pull requests

Describe the user-visible change, configuration impact, and validation. Keep
changes small and do not include generated build files or secrets.

By contributing, you agree that your contribution is licensed under
[Apache-2.0](LICENSE).
