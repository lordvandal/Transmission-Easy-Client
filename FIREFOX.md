# Transmission Easy Client for Firefox

This fork publishes a Firefox build of the extension that Mozilla signs as an
**unlisted** (self-distributed) add-on. It is not on addons.mozilla.org. It is
installed from this repository's GitHub Releases and updates itself from there.

Credits: originally written by **Feverqwe**, maintained by **mthcore**
(upstream: <https://github.com/mthcore/Transmission-Easy-Client>).

## Install

1. Open the [latest release](https://github.com/lordvandal/Transmission-Easy-Client/releases/latest).
2. Download `transmission-easy-client-firefox-X.Y.Z.N.xpi`.
3. Drag the file onto a Firefox window (or open `about:addons` → gear icon →
   *Install Add-on From File…*) and confirm.

The file is signed by Mozilla, so the install is permanent (unlike
*Load Temporary Add-on* in `about:debugging`). Requires Firefox 140 or newer.

## Automatic updates

The Firefox manifest declares:

```
browser_specific_settings.gecko.update_url =
  https://github.com/lordvandal/Transmission-Easy-Client/releases/latest/download/updates.json
```

Every release attaches an `updates.json` like this:

```json
{
  "addons": {
    "transmission-easy-client@lordvandal": {
      "updates": [
        { "version": "3.5.0.1", "update_link": "https://github.com/lordvandal/Transmission-Easy-Client/releases/download/v3.5.0.1/transmission-easy-client-firefox-3.5.0.1.xpi" }
      ]
    }
  }
}
```

Firefox checks `update_url` about once a day (or right away with *Check for
Updates* in `about:addons`). `releases/latest/` always points at the newest
non-prerelease release, so when its version is higher than the installed one,
Firefox downloads the signed `.xpi` from `update_link` and installs it.

## The add-on id must never change

`transmission-easy-client@lordvandal` (in `builder/transformManifest.js`) is
how Firefox and Mozilla identify this add-on. Signing and updates are tied to
it. If it changes, Firefox treats the result as a different add-on and existing
installs never update to it. Do not change it.

## Versioning

AMO accepts only numeric versions with at most 4 parts. The Firefox version is:

```
<upstream version from src/manifest.json>.<FIREFOX_REVISION>
```

for example `3.5.0` + `1` → `3.5.0.1`. `FIREFOX_REVISION` (a file at the
repository root) is the only place the 4th part lives. Chrome and Opera builds
keep the plain upstream version.

Each signed version can be uploaded to Mozilla only once, so every release
needs a new version.

## Cut a release

### From the GitHub website (no git needed)

1. Bump the 4th part (skip this for the very first release, `3.5.0.1`):
   open `FIREFOX_REVISION` on GitHub, click the pencil icon, change the number
   (e.g. `1` → `2`) and commit it to `develop`.
2. Go to **Actions** → **Firefox Release** → **Run workflow**, leave the branch
   on `develop`, and click the green **Run workflow** button.

The workflow works out the version (e.g. `3.5.0.2`) and creates the tag
`v3.5.0.2` together with the release. Do **not** use *Draft a new release*:
the workflow creates the release itself and would fail if one already exists.

### With git

Bump `FIREFOX_REVISION`, commit and push to `develop`, then:

```sh
git tag v3.5.0.2
git push origin v3.5.0.2
```

### What the workflow does

`.github/workflows/firefox-release.yml`:

- fails early if the version was already released, or if a pushed tag (without
  `v`) is not the version the Firefox build produces
- runs `npm ci`, type-check, tests, `build:firefox` and `web-ext lint`
- signs the build on the unlisted channel with the `AMO_JWT_ISSUER` /
  `AMO_JWT_SECRET` repository secrets
- creates the GitHub release with the signed `.xpi` and `updates.json`

If the workflow fails **after** signing succeeded, Mozilla already has that
version. Bump `FIREFOX_REVISION` again and release again instead of re-running.

To check the build locally:

```sh
npm ci
npm run build:firefox
npx web-ext@latest lint --source-dir=dist/firefox/src --self-hosted
```

The built extension is in `dist/firefox/src` (not `dist`).

## Sync with upstream

### Automatically (Upstream Sync workflow)

`.github/workflows/upstream-sync.yml` runs every day at 04:17 UTC. You can also
start it from **Actions** → **Upstream Sync** → **Run workflow**. Each run:

1. merges `mthcore/Transmission-Easy-Client` `develop` into this fork's `develop`
   (if there is nothing new, it stops here)
2. sets the Firefox version:
   - upstream version changed (e.g. `3.5.0` → `3.6.0`): `FIREFOX_REVISION` goes back to `1`
   - same upstream version, but the add-on's code changed: `FIREFOX_REVISION` goes up by 1
   - only docs or CI files changed: no change and no release
3. runs type-check, tests, `build:firefox` and `web-ext lint`, and pushes to
   `develop` only if they all pass
4. starts **Firefox Release**, which signs and publishes the new version.
   Installed copies then update themselves.

One-time setup: create the `SYNC_TOKEN` secret. Upstream sometimes changes
files in `.github/workflows/`, and GitHub does not let the workflow's built-in
token push such a merge.

1. GitHub → your profile picture → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Name it `upstream-sync`, pick an expiration (GitHub emails you before it
   expires), set **Repository access** to *Only select repositories* →
   `lordvandal/Transmission-Easy-Client`.
3. Under **Repository permissions**, set **Contents** to *Read and write* and
   **Workflows** to *Read and write*. Click **Generate token** and copy it.
4. In this repository: **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**, name `SYNC_TOKEN`, paste the token, **Add secret**.

Without the secret, syncs that don't touch upstream's workflow files still
work; the others fail at the push step.

To sync without releasing automatically, add a repository **variable** (same
page, *Variables* tab) named `AUTO_RELEASE` with the value `false`. Then
release yourself with **Run workflow** as described above.

When it needs you:

- **Merge conflict**: upstream changed the same lines as this fork (most
  likely in `builder/transformManifest.js` or its test). The run fails, GitHub
  emails you, and nothing is pushed. The log names the files. Resolve it
  with git, or ask for help with those files.
- **Checks fail** after the merge: nothing is pushed, and the run retries
  every day. It succeeds once upstream fixes the problem.
- GitHub turns off scheduled workflows in a repository with no activity for
  60 days. If that happens, **Actions** shows a banner with a button to
  re-enable it.

### By hand

From the website: on the repository's main page (branch `develop`), click
**Sync fork** → **Update branch**. Then set `FIREFOX_REVISION` yourself (rules
below) and release with **Run workflow**.

With git:

```sh
git remote add upstream https://github.com/mthcore/Transmission-Easy-Client.git   # once
git fetch upstream
git merge upstream/develop
```

If the merge changed the upstream version in `src/manifest.json` (e.g.
`3.5.0` → `3.6.0`), reset `FIREFOX_REVISION` to `1` so the next release is
`v3.6.0.1`. If the upstream version did not change, bump `FIREFOX_REVISION`
as usual.

Note: upstream's own `release.yml` also runs when you push a `v*` tag with git.
On this fork it fails at its "tag matches the manifest version" check for
4-part tags and publishes nothing (its store deploy jobs are disabled unless the
`DEPLOY_*` variables are set). Only the **Firefox Release** run matters here.
Releasing with **Run workflow** does not start it.
