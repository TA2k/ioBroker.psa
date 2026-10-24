# Compatibility report

## Scope

This report describes the compatibility evidence currently available in the adapter repository. It does not claim a complete comparison against every state ever produced by older PSA adapter versions; no full historical object export or sanitized oldApi/newApi payload fixtures are present.

## Preserved configuration

The adapter keeps the existing native keys and meanings:

| Key | Existing meaning | Upgrade handling |
| --- | --- | --- |
| `type` | Brand selection | Preserved; runtime accepts `peugeot`, `citroen`, `driveds`, and `opel`. |
| `interval` | Vehicle polling interval in minutes | Preserved; existing values remain effective, with a 0.5-minute minimum and 5-minute fallback for missing/non-numeric values. |
| `auth_code` | One-time OAuth authorization code or redirect URL | Preserved; consumed for login and cleared from instance config on unload according to the existing adapter flow. |
| `code_verifier` | Existing Admin OAuth verifier field | Preserved in settings; the current exchange follows the existing auth implementation. |
| `user`, `password` | Historical credentials | Preserved in native configuration; not used by the v4 OAuth-code login. Password protection declarations remain unchanged. |

The existing serialized `auth.session` structure and its token field names are retained. Valid saved sessions are parsed and loaded before refresh; malformed values are not automatically deleted.

## Object/state evidence

The golden-master contract in `test/testCompatibility.js` covers sanitized user and vehicle-status examples. It asserts the known IDs and representative values, including:

- `user._embedded.veh123.id`, `user._embedded.veh123.vin`, `user._embedded.veh123.brand`, and `user._embedded.veh123.model`
- `VF3TEST12345.status.car.gps.latitude`, `.longitude`, `.battery.level`, and `.type`
- representative object `common.type`, `common.role`, `read`, and `write` metadata

`test/testCompatibilityMapping.js` also verifies that undefined fields are removed without changing the retained payload shape. Historical objects are never deleted by the current runtime migration or cleanup. The additional `diagnostics.lastSuccessfulUpdate` state is additive and separate from the existing vehicle namespaces.

## Backend transition and known limitations

- The active backend is Stellantis Connected Car API v4.
- The old mileage/mobile-services runtime fallback was unreachable from active startup (its startup call sites were commented out) and has been removed. Existing oldApi/newApi objects, if already present in an installation, are not removed, but their values will no longer refresh from the retired fallback.
- The available golden master does not cover full historical `oldApi`/`newApi` object trees, all vehicle brands, all optional v4 fields, or every multi-vehicle response shape. These remain unverified.
- No real vehicle status comparison across old and new adapter releases was performed as part of CI.

## Gate before a stable release

In a disposable ioBroker installation, snapshot adapter configuration, `auth.session`, and all `psa.0` objects/states before and after upgrade. Compare IDs, object types, common metadata, representative state values, and verify that historical states are retained. Exercise each supported brand and multiple vehicles where authorized. Keep any mismatches as explicit blockers instead of changing old IDs or semantics silently.
