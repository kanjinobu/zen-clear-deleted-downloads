# Hide Deleted Downloads

A Sine mod for Zen Browser that adds **Hide deleted downloads** directly below **Clear all downloads** in the Downloads library-tab context menu.

When clicked, it checks each download's local target path. If the path can be checked and the file is missing, it calls Zen's own `DownloadsCommon.deleteDownload(download)` method. Existing files and paths that cannot be checked are left alone.

## Install

1. Put `theme.json` at the repository root.
2. Put the script at `js/hide-deleted-downloads.uc.js`.
3. Add the repository to Sine using the repository's Git URL, then enable the mod.
4. Restart Zen if Sine asks you to.

## Notes

- This mod uses internal Zen/Firefox APIs and is intended for the Zen 1.23.4b structure discussed during development.
- A missing path is treated as a missing file. If a drive/share is disconnected but the OS reports the path as absent, its entry may be hidden too.
- The mod does not delete files. It calls Zen's own download-record removal method.
- Check the Sine manifest conventions used by your installed Sine version if its schema differs; Sine repository formats can change.
