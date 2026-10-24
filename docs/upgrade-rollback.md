# Configuration upgrade and rollback procedure

## Compatibility policy

This implementation keeps the existing native configuration keys and does not rename or delete them:

- `type` — selected brand (`peugeot`, `citroen`, `driveds`, or `opel`)
- `interval` — polling interval in minutes (existing default: 5; minimum accepted: 0.5)
- `auth_code` — one-time authorization code or redirect URL
- `code_verifier` — verifier value stored by the existing Admin flow
- `user` and `password` — legacy fields retained for upgrade compatibility; they are not required by the current v4 login flow

The Admin page now overlays edited form values onto the saved native configuration rather than replacing it with only visible fields. Unrecognized settings are therefore retained. Missing or non-numeric polling intervals fall back to five minutes; finite intervals below 0.5 minutes (including zero or negative values) retain the established clamp to 0.5. Valid configured intervals and valid stored v4 sessions are preserved.

Existing `auth.session` values are read as JSON strings (the existing format) or objects. Session fields are not renamed, and a malformed value is left untouched while a new login may be attempted if an authorization code is configured. No automatic session deletion or forced reauthentication is performed by this upgrade path.

The adapter's active backend is Stellantis Connected Car API v4. Unreachable legacy mileage/mobile-services methods were removed; old `oldApi`/`newApi` objects and states are not deleted, but the retired methods no longer update them. Their historical native settings are retained. The unused legacy client certificate is not included in npm distributions.

## Before upgrading

1. Stop the adapter instance.
2. Create an ioBroker backup that includes the instance configuration and adapter states/objects. The `auth.session` state contains OAuth credentials; store the backup securely and do not attach it to bug reports.
3. Record the configured brand and polling interval. Do not copy authorization codes, access tokens, refresh tokens, VINs, or location data into notes or logs.
4. Upgrade only the adapter files/package in the intended test or production environment, then start the instance and inspect the adapter log for brand/configuration errors.

## Rollback

1. Stop the adapter instance before changing files or restoring data.
2. Restore the previous adapter version using the normal ioBroker package/repository workflow.
3. If configuration or adapter states were changed, restore the matching pre-upgrade ioBroker backup. Restoring only the old code while retaining incompatible state data is not a reliable rollback.
4. Restart the instance and verify the prior configured brand, interval, session state, and existing object IDs. If the session is rejected by Stellantis, obtain a fresh authorization code using the Admin login flow; never restore credentials from an untrusted backup.

Do not delete existing adapter objects during rollback. No live rollback or older-version upgrade was executed as part of the automated tests; perform this procedure first in a disposable ioBroker instance before using it operationally.

## Disposable upgrade test checklist

- Save a copy of native settings containing all known keys and an extra test-only key; open and save Admin settings; compare the resulting native object to confirm existing and unknown keys remain.
- Test fresh defaults with no configured interval, then test an existing interval of 7 minutes and a below-minimum interval. Confirm effective values are 5, 7, and 0.5 minutes, respectively.
- Restore a sanitized valid JSON session fixture and confirm parsed fields are unchanged. Test malformed JSON and confirm the adapter does not delete/overwrite the old value before a successful login.
- Compare configuration and object snapshots before/after start; check that established state IDs and metadata have not been renamed or removed.
- Restore the pre-test backup and confirm the disposable instance returns to its original version/configuration.
