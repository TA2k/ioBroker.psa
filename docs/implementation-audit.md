# PSA adapter implementation audit

## Baseline snapshot

The adapter runtime is now split between `main.js` and focused modules under `lib/`. Its active backend behavior is:

- v4 Stellantis OAuth login and refresh flow
- vehicle discovery on `https://api.groupe-psa.com/connectedcar/v4/user`
- vehicle status/detail fetches via `getRequest()`
- object writing through `json2iob.parse()`
- legacy session persistence in `auth.session`

## Backend boundary after legacy cleanup

The runtime uses Stellantis Connected Car API v4 through `lib/transport.js` and `lib/vehicle.js`. The unreferenced legacy mileage and mobile-services methods (including `/api/v1/user`, `GetAccessToken`, and the MyM microservices calls) have been removed from runtime code. Their old call sites were already commented out, so removing these unreachable methods does not change current startup behavior.

The historical native settings (`user`, `password`, `code_verifier`, `auth_code`, `type`, and `interval`) are retained for upgrade compatibility. Existing `oldApi`/`newApi` objects and state trees are not deleted or rewritten. The available golden-master regression test covers the `user` and vehicle-status trees; it does not claim full historical `oldApi`/`newApi` payload coverage. The old client certificate bundle has no runtime references and is excluded from npm distributions via `.npmignore`; the local source artifact remains inert.

## Current validation status

The adapter was validated with the repo scripts after dependency installation. The current baseline is passing:

- `npm run lint`
- `npm test`

These checks are valid as of the current snapshot and are the guardrail for all further compatibility work.

## Compatibility freeze

The golden-master object contract remains in place while internal API/auth logic is refactored. It protects the captured `user` and vehicle-status state IDs and metadata; other payload families remain unverified until sanitized fixtures are available.
