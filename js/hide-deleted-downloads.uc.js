// Hide Deleted Downloads
// Zen Browser 1.23.4b; Sine userChrome script
// Adds "Hide deleted downloads" below "Clear all downloads" in the library-tab menu.
// It does not delete files from disk. It removes missing-file download entries using Zen's
// native DownloadsCommon.deleteDownload() method.

(() => {
  "use strict";

  const SCRIPT_ID = "hide-deleted-downloads-script";
  const MENU_ID = "hide-deleted-downloads-menuitem";
  const MENU_SELECTOR = ".zen-library-tab-menu";
  const CLEAR_SELECTOR = '[data-l10n-id="library-downloads-clear-all"]';

  let busy = false;

  function getDownloadsCommon() {
    try {
      const { DownloadsCommon } = ChromeUtils.importESModule(
        "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs"
      );
      return DownloadsCommon;
    } catch (error) {
      console.error("[Hide Deleted Downloads] Could not load DownloadsCommon:", error);
      return null;
    }
  }

  function getTargetPath(download) {
    if (typeof download?.target?.path === "string" && download.target.path) {
      return download.target.path;
    }

    const targetURL = download?.target?.url;
    if (typeof targetURL === "string" && targetURL.startsWith("file:")) {
      try {
        return Services.io.newURI(targetURL).QueryInterface(Ci.nsIFileURL).file.path;
      } catch (error) {
        console.warn("[Hide Deleted Downloads] Could not resolve target URL:", error);
      }
    }

    return null;
  }

  function targetFileIsMissing(download) {
    const path = getTargetPath(download);
    if (!path) {
      // Unknown/non-local target: never remove it automatically.
      return false;
    }

    try {
      const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(path);
      return !file.exists();
    } catch (error) {
      // A failed check is "unknown", not proof that the file is missing.
      console.warn("[Hide Deleted Downloads] Could not check target; leaving entry untouched:", error);
      return false;
    }
  }

  async function hideMissingDownloads(menuitem) {
    if (busy) return;

    busy = true;
    menuitem.setAttribute("disabled", "true");

    let removed = 0;
    try {
      const Downloads = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs").Downloads;
      const DownloadsCommon = getDownloadsCommon();

      if (!DownloadsCommon || typeof DownloadsCommon.deleteDownload !== "function") {
        console.error("[Hide Deleted Downloads] Zen's deleteDownload method is unavailable.");
        return;
      }

      const list = await Downloads.getList(Downloads.ALL);
      const downloads = await list.getAll();

      for (const download of downloads) {
        if (!targetFileIsMissing(download)) continue;

        try {
          await DownloadsCommon.deleteDownload(download);
          removed++;
        } catch (error) {
          console.error("[Hide Deleted Downloads] Failed to remove a missing-file entry:", error);
        }
      }

      console.info(`[Hide Deleted Downloads] Removed ${removed} missing-file download entr${removed === 1 ? "y" : "ies"}.`);
    } catch (error) {
      console.error("[Hide Deleted Downloads] Scan failed:", error);
    } finally {
      menuitem.removeAttribute("disabled");
      busy = false;
    }
  }

  function addMenuItem(menu) {
    if (!menu || menu.querySelector(`#${MENU_ID}`)) return;

    const clearAll = menu.querySelector(CLEAR_SELECTOR);
    if (!clearAll) return;

    const item = document.createXULElement("menuitem");
    item.id = MENU_ID;
    item.setAttribute("label", "Hide deleted downloads");
    item.setAttribute("tooltiptext", "Remove download entries whose target files are missing");
    item.addEventListener("command", () => hideMissingDownloads(item));

    clearAll.insertAdjacentElement("afterend", item);
  }

  function scanMenus() {
    document.querySelectorAll(MENU_SELECTOR).forEach(addMenuItem);
  }

  function start() {
    if (document.getElementById(SCRIPT_ID)) return;

    const marker = document.createXULElement("box");
    marker.id = SCRIPT_ID;
    marker.hidden = true;
    document.documentElement.appendChild(marker);

    scanMenus();

    const observer = new MutationObserver(scanMenus);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
