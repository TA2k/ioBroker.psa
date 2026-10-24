![Logo](admin/psa.png)
# ioBroker.psa

[![NPM version](https://img.shields.io/npm/v/iobroker.psa.svg)](https://www.npmjs.com/package/iobroker.psa)
[![Downloads](https://img.shields.io/npm/dm/iobroker.psa.svg)](https://www.npmjs.com/package/iobroker.psa)
![Number of Installations (latest)](https://iobroker.live/badges/psa-installed.svg)
![Number of Installations (stable)](https://iobroker.live/badges/psa-stable.svg)
[![Dependency Status](https://img.shields.io/david/TA2k/iobroker.psa.svg)](https://david-dm.org/TA2k/iobroker.psa)

[![NPM](https://nodei.co/npm/iobroker.psa.png?downloads=true)](https://nodei.co/npm/iobroker.psa/)

**Tests:** ![Test and Release](https://github.com/TA2k/ioBroker.psa/workflows/Test%20and%20Release/badge.svg)

## psa adapter for ioBroker

PSA Adapter for Peugeot, Citroen, DS, Opel

## Diagnostics

The additive `diagnostics.lastSuccessfulUpdate` state records the Unix timestamp in milliseconds of the most recent successful vehicle-status response. Existing vehicle states are retained during request failures; `info.connection` reports current API reachability rather than whether a token is merely stored.

## Upgrade and rollback

Existing configuration keys and valid saved sessions are retained. Before upgrading, back up the ioBroker instance configuration and adapter states/objects; the session state contains OAuth credentials. See [docs/upgrade-rollback.md](docs/upgrade-rollback.md) for the compatibility details and disposable-instance rollback checklist.

See [docs/compatibility-report.md](docs/compatibility-report.md) for the currently tested object/state contract and known coverage gaps, and [docs/test-report.md](docs/test-report.md) for recorded validation results and release gates.

## Changelog

### 0.0.15

- Hardened v4 session refresh, polling recovery, and shutdown cancellation.
- Preserved existing native settings and documented upgrade/rollback behavior.
- Removed unreachable legacy API runtime fallbacks; historical state objects are not deleted.

0.0.8 Initial release

## License

MIT License

Copyright (c) 2021 TA2k

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
