# Hide Deleted Downloads

A small [Sine](https://github.com/CosmoCreeper/Sine) mod for [Zen Browser](https://zen-browser.app/) that adds **Hide deleted downloads** below **Clear all downloads** in the Downloads library-tab context menu.

Click it to find download entries whose local target files no longer exist and remove those entries using Zen's native `DownloadsCommon.deleteDownload()` method.

## Features

- Adds one command to the Downloads library-tab context menu.
- Checks local target paths before removing entries.
- Leaves entries alone when the target path cannot be determined or checked.
- Uses Zen's own download-removal method instead of directly editing the UI or download database.
- Does **not** delete files from disk.

## Important behavior and cautions

- This is not a temporary hide/filter. Zen's native removal method removes the download entry and may remove its associated browsing-history entry, matching Zen's own behavior for removing a download.
- If a drive or network share is disconnected and the operating system reports its files as missing, those entries may also be removed. Reconnect external/network storage before running the command if that matters to you.
- This mod uses internal Zen/Firefox APIs and DOM selectors. It was tested by the author on **Zen Browser 1.23.4b on Windows**; compatibility with other versions is not guaranteed.
- Make a backup of important download/history data before using mods that alter browser records. Use at your own discretion.

## Install with Sine

1. Install [Sine](https://github.com/CosmoCreeper/Sine) in Zen Browser.
2. Add this repository as a Sine repository using the repository URL: `https://github.com/kanjinobu/zen-clear-deleted-downloads`
3. Find **Hide Deleted Downloads** in Sine and install/enable it.
4. Restart Zen if Sine asks you to.
5. Open the Downloads library tab, open its tab context menu, and choose **Hide deleted downloads**.

If Sine does not list the mod, check that `theme.json` is at the repository root and that the script path in the manifest matches `js/hide-deleted-downloads.uc.js`.

## Uninstall

Disable or uninstall the mod in Sine. The script does not delete downloaded files.

## Troubleshooting

- **Menu item is missing:** restart Zen and confirm the mod is enabled in Sine. Zen updates may change the menu selector or manifest format.
- **Nothing is removed:** the mod only considers entries with a local target path that the operating system reports as missing. Entries with unknown paths are intentionally skipped.
- **Errors:** open Zen's Browser Console and look for messages prefixed with `[Hide Deleted Downloads]`.

## Repository contents

- `theme.json` — Sine metadata and script registration.
- `js/hide-deleted-downloads.uc.js` — the mod script.
- `README.md` — setup, behavior, limitations, and troubleshooting.

## License

MIT. See [`LICENSE`](LICENSE).
