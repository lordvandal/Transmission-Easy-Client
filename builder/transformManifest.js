/**
 * Per-browser manifest rewrite, extracted from webpack.config.js so it can be
 * tested.
 *
 * This code decides whether the add-on can be INSTALLED at all, and it has got
 * that wrong before: a Firefox build once declared a background type Firefox
 * has never supported and could not be installed, while every test passed.
 * The test suite runs through Vitest's transform pipeline, never webpack's, so
 * a defect here is structurally invisible to it — unless the logic is a plain
 * function, which is what this file is for.
 *
 * Pure by contract: no I/O, no webpack, no mutation of its input. The Firefox
 * packaging revision is passed in (builder/defaultBuildEnv.js reads it from
 * the FIREFOX_REVISION file) so the tests do not have to touch the disk.
 *
 * @param {object} manifest  parsed src/manifest.json (not mutated)
 * @param {string} browser   'chrome' | 'firefox' | 'opera'
 * @param {object} [options]
 * @param {string|number} [options.firefoxRevision]  4th version part of the
 *   Firefox build; required when browser is 'firefox'
 * @returns {object} the manifest to emit
 */
const GECKO_ID = 'transmission-easy-client@lordvandal';
const UPDATE_URL =
  'https://github.com/lordvandal/Transmission-Easy-Client/releases/latest/download/updates.json';
const FIREFOX_NAME = 'Transmission Easy Client for Firefox';
const FIREFOX_DESCRIPTION =
  'Extension add Transmission web GUI in your web browser. ' +
  'Original author: Feverqwe. Fork maintainer: mthcore.';

/** AMO version parts are integers without leading zeros, at most 9 digits. */
function firefoxRevision(value) {
  const revision = String(value ?? '').trim();
  if (!/^[1-9]\d{0,8}$/.test(revision)) {
    throw new Error(
      `Invalid Firefox packaging revision ${JSON.stringify(value)}: ` +
        'expected a positive integer without leading zeros (see FIREFOX_REVISION)'
    );
  }
  return revision;
}

function transformManifest(manifest, browser, options = {}) {
  if (browser !== 'firefox') {
    // Chrome and Opera ship src/manifest.json verbatim.
    return manifest;
  }

  const result = { ...manifest };

  // Chrome-specific and meaningless to Firefox
  delete result.minimum_chrome_version;

  // Firefox has no extension service workers: an MV3 add-on declaring only
  // background.service_worker is REJECTED at install ("background.service_worker
  // is currently disabled"). The bundle is a classic script, so an event page
  // runs it as-is.
  result.background = {
    scripts: [manifest.background.service_worker],
  };

  // AMO accepts at most 4 numeric parts. Upstream owns the first three; the
  // 4th is this fork's packaging revision, so Firefox can be re-released
  // without waiting for an upstream version bump.
  result.version = `${manifest.version}.${firefoxRevision(options.firefoxRevision)}`;

  // Branding of the self-distributed build. Literal strings, not __MSG_ keys:
  // the localized appName/appDesc are shared with the Chrome and Opera builds.
  result.name = FIREFOX_NAME;
  result.description = FIREFOX_DESCRIPTION;

  result.browser_specific_settings = {
    gecko: {
      // Hard-coded on purpose: Firefox identifies the installed add-on by this
      // id, and both signing and auto-update are tied to it. Changing it makes
      // a NEW add-on that existing installs never update to.
      id: GECKO_ID,
      // 140 is the first release where BOTH pieces work: host permissions
      // granted at install (127+) and the data collection metadata below
      // (140+). Declaring 127 made addons-linter warn that the consent data
      // is ignored.
      strict_min_version: '140.0',
      // Required by AMO since 2025-11: declare that nothing is collected
      data_collection_permissions: {
        required: ['none'],
      },
      // Self-distributed (unlisted) build: Firefox polls this file for updates.
      // It is attached to every GitHub release by firefox-release.yml.
      update_url: UPDATE_URL,
    },
    // Android got data_collection_permissions two releases later
    gecko_android: {
      strict_min_version: '142.0',
    },
  };

  // navigator.clipboard.writeText outside a user gesture needs this on Firefox
  // (Chrome grants it implicitly to extension pages)
  result.permissions = [...manifest.permissions, 'clipboardWrite'];

  return result;
}

module.exports = transformManifest;
module.exports.GECKO_ID = GECKO_ID;
module.exports.UPDATE_URL = UPDATE_URL;
