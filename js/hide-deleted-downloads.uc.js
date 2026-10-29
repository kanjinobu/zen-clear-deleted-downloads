// Hide Deleted Downloads — Zen Browser 1.23.4b
// Adds a command to the Downloads library tab context menu.
// Uses Zen's own DownloadsCommon.deleteDownload() for each confirmed missing file.

(() => {
  "use strict";

  const SCRIPT_ID = "hide-deleted-downloads-command";
  const MENU_ID = "hide-deleted-downloads-menuitem";
  const MENU_SELECTOR = ".zen-library-tab-menu";
  const CLEAR_SELECTOR = '[data-l10n-id="library-downloads-clear-all"]';

  let observer;
  let busy = false;

  function getDownloadsCommon() {
    try {
      if (typeof ChromeUtils === "undefined") return null;
      const module = ChromeUtils.importESModule(
        "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs"
      );
      return module.DownloadsCommon || null;
    } catch (error) {
      console.error("[HideDeletedDownloads] Could not import DownloadsCommon:", error);
      return null;
    }
  }

  function getFilePath(download) {
    // Firefox/Zen Downloads API normally exposes a file:// target URL here.
    const target = download?.target?.path;
    if (typeof target === "string" && target.length) return target;

    const url = download?.target?.url;
    if (typeof url === "string" && url.startsWith("file:")) {
      try {
        return Services.io.newURI(url).QueryInterface(Ci.nsIFileURL).file.path;
      } catch (_) {}
    }
    return null;
  }

  async function isDefinitelyMissing(download) {
    const path = getFilePath(download);
    if (!path) return false;

    try {
      const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(path);
      // exists() is a boolean check; any exception is treated as "unknown", not missing.
      return !file.exists();
    } catch (error) {
      console.warn("[HideDeletedDownloads] Could not check download path; leaving it alone:", path, error);
      return false;
    }
  }

  async function hideMissingDownloads(menuitem) {
    if (busy) return;
    busy = true;
    menuitem.setAttribute("disabled", "true");

    try {
      const common = getDownloadsCommon();
      if (!common?.deleteDownload) {
        console.error("[HideDeletedDownloads] DownloadsCommon.deleteDownload is unavailable.");
        return;
      }

      const downloadsModule = ChromeUtils.importESModule(
        "resource://gre/modules/Downloads.sys.mjs"
      );
      const downloads = await downloadsModule.Downloads.getList(downloadsModule.Downloads.ALL);
      const allDownloads = await downloads.getAll();

      let hidden = 0;
      for (const download of allDownloads) {
        if (await isDefinitelyMissing(download)) {
          try {
            await common.deleteDownload(download);
            hidden++;
          } catch (error) {
            console.error("[HideDeletedDownloads] Could not hide a missing download:", error);
          }
        }
      }

      console.info(`[HideDeletedDownloads] Finished. Hidden missing downloads: ${hidden}.`);
    } catch (error) {
      console.error("[HideDeletedDownloads] Failed to scan downloads:", error);
    } finally {
      menuitem.removeAttribute("disabled");
      busy = false;
    }
  }

  function installMenuItem(menu) {
    if (!menu || menu.querySelector(`#${MENU_ID}`)) return;

    const clearAll = menu.querySelector(CLEAR_SELECTOR);
    if (!clearAll) return;

    const item = document.createXULElement("menuitem");
    item.id = MENU_ID;
    item.setAttribute("label", "Hide deleted downloads");
    item.setAttribute("accesskey", "H");
    item.addEventListener("command", () => hideMissingDownloads(item));

    // Place directly after "Clear all downloads", as requested.
    clearAll.insertAdjacentElement("afterend", item);
  }

  function scanMenus() {
    document.querySelectorAll(MENU_SELECTOR).forEach(installMenuItem);
  }

  function start() {
    if (document.getElementById(SCRIPT_ID)) return;
    const marker = document.createXULElement("box");
    marker.id = SCRIPT_ID;
    marker.hidden = true;
    document.documentElement.appendChild(marker);

    scanMenus();
    observer = new MutationObserver(scanMenus);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
