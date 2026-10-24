# Test report

Date: 2026-10-14

## Repository checks

Validation run in `C:\Sascha\ioBroker.psa` on 2026-10-14:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 16 JavaScript tests and 38 package validation checks. |
| `npm run lint` | Passed. |
| `npm run check` | Passed after adding runtime JSDoc contracts and narrowing error handling. `tsconfig.check.json` checks runtime JavaScript while excluding Mocha test files and skips third-party declaration-file checking; tests are covered by `npm test`. |
| `npm run test:integration` | Attempted; the harness selected `iobroker.js-controller@8.0.0-alpha.6`, which requires Node.js `>=22.19.0`; this terminal runs Node.js `20.16.0`. Setup then failed because the temporary controller data directory was not initialized. The user's ioBroker instance was not involved. |
| ioBroker Repository Checker | Not run; checker is not installed in this workspace. |
| Live Stellantis login / refresh / polling | Not repeated for this step; no credentials or live API test used. |

The static backend-boundary test verifies active adapter transport/vehicle modules contain v4 endpoint paths and that the retired v1/mobile-services fallback strings and methods do not return to runtime source. The target Git checkout's `@iobroker/testing` package check reports 38 checks (rather than 43 in the installed copy), with all passing.

## CI configuration

The repository already has `.github/workflows/test-and-release.yml`, using ioBroker's maintained check/lint and adapter test actions across Node.js 18, 20, and 22 on Ubuntu, Windows, and macOS. No duplicate workflow was added. The workflow was not executed by GitHub Actions from this workspace.

## Release status and outstanding gates

The adapter version is bumped to `0.0.15` for the next patch candidate. No release was created or published. The implementation is recorded in local commits `6d076ed` and `b1deea6`; neither has been pushed. The npm pack dry-run confirmed the retired certificate bundle is excluded from the package. Before beta/stable release, run the integration test, Repository Checker, and a disposable ioBroker configuration/object snapshot comparison. Live API validation across brands and a full legacy object snapshot comparison remain unverified.
