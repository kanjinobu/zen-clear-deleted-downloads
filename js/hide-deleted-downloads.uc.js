
 // Hide Deleted Downloads
// Zen Browser 1.23.4b; Sine userChrome script
// Removes download entries whose target files are missing.
// Does not intentionally delete files or unrelated history visits.

(() => {
  "use strict";

  const SCRIPT_ID = "hide-deleted-downloads-script";
  const MENU_ID = "hide-deleted-downloads-menuitem";
  const MENU_SELECTOR = ".zen-library-tab-menu";
  const CLEAR_SELECTOR = '[data-l10n-id="library-downloads-clear-all"]';

  // TEST MODE: remove at most one matching entry per click.
  // After successful testing, set to 0 to remove all matching entries.
  const MAX_REMOVALS_PER_RUN = 1;

  let busy = false;

  function getTargetPath(download) {
    if (typeof download?.target?.path === "string" &&
        download.target.path) {
      return download.target.path;
    }

    const targetURL = download?.target?.url;
    if (typeof targetURL === "string" &&
        targetURL.startsWith("file:")) {
      try {
        return Services.io.newURI(targetURL)
          .QueryInterface(Ci.nsIFileURL).file.path;
      } catch (error) {
        console.warn(
          "[Hide Deleted Downloads] Could not resolve target URL:",
          error
        );
      }
    }

    return null;
  }

  async function targetFileIsMissing(download) {
    const path = getTargetPath(download);
    if (!path) return false;

    try {
      return !(await IOUtils.exists(path));
    } catch (error) {
      // An inaccessible or unverifiable path is not proof of absence.
      console.warn(
        "[Hide Deleted Downloads] Could not check target; keeping entry:",
        error
      );
      return false;
    }
  }

  function getSourceURL(download) {
    const source =
      download?.source?.originalUrl || download?.source?.url;

    if (typeof source === "string") return source;
    if (typeof source?.spec === "string") return source.spec;
    if (typeof source?.href === "string") return source.href;

    return null;
  }

  function getDownloadVisitDate(download) {
    // Historical Places node time is in microseconds.
    const placesTime = download?.placesNode?.time;

    if (Number.isFinite(placesTime)) {
      return new Date(placesTime / 1000);
    }

    // Session downloads are recorded using download.startTime.
    const startTime = download?.startTime;

    if (startTime && typeof startTime.getTime === "function") {
      const time = startTime.getTime();
      return Number.isFinite(time) ? new Date(time) : null;
    }

    if (Number.isFinite(startTime)) {
      return new Date(startTime);
    }

    return null;
  }

  async function removeDownloadVisit(download, PlacesUtils) {
    const url = getSourceURL(download);
    const date = getDownloadVisitDate(download);

    if (!url || !date || !Number.isFinite(date.getTime())) {
      throw new Error(
        "Cannot identify the exact download visit; entry was not safely removed."
      );
    }

    // Remove one DOWNLOAD visit at the download's recorded start time.
    // Other visit types for this URL are not selected.
    const removed = await PlacesUtils.history.removeVisitsByFilter({
      url,
      transition: PlacesUtils.history.TRANSITIONS.DOWNLOAD,
      beginDate: date,
      endDate: date,
      limit: 1,
    });

    if (!removed) {
      throw new Error(
        "No matching download visit was found. The entry may remain."
      );
    }
  }

  async function removeSessionDownload(download, sessionList) {
    // Remove from the real Downloads list, not merely from the UI.
    await sessionList.remove(download);

    if (typeof download.finalize === "function") {
      await download.finalize(true);
    }
  }

  async function hideMissingDownloads(menuitem) {
    if (busy) return;

    busy = true;
    menuitem.setAttribute("disabled", "true");

    let removed = 0;
    let failed = 0;

    try {
      const { Downloads } = ChromeUtils.importESModule(
        "resource://gre/modules/Downloads.sys.mjs"
      );

      const { DownloadHistory } = ChromeUtils.importESModule(
        "resource://gre/modules/DownloadHistory.sys.mjs"
      );

      const { PlacesUtils } = ChromeUtils.importESModule(
        "resource://gre/modules/PlacesUtils.sys.mjs"
      );

      const sessionList = await Downloads.getList(Downloads.ALL);
      const sessionDownloads = await sessionList.getAll();
      const sessionSet = new Set(sessionDownloads);

      const historyList = await DownloadHistory.getList({
        type: Downloads.ALL,
      });

      const downloads = await historyList.getAll();

      console.info(
        `[Hide Deleted Downloads] Scanning ${downloads.length} entries ` +
        `(${sessionDownloads.length} current-session entries).`
      );

      for (const download of downloads) {
        // Never touch a download that is still in progress.
        if (!download.stopped) continue;

        if (!(await targetFileIsMissing(download))) continue;

        try {
          const isSessionDownload = sessionSet.has(download);

          if (isSessionDownload) {
            await removeSessionDownload(download, sessionList);
          } else if (!download.placesNode) {
            // Do not guess how to remove an unknown object.
            console.warn(
              "[Hide Deleted Downloads] No historical Places node; keeping entry:",
              download
            );
            continue;
          }

          // Remove the corresponding Places download visit.
          // This avoids clearing all history for the source URL.
          await removeDownloadVisit(download, PlacesUtils);

          removed++;

          console.info(
            "[Hide Deleted Downloads] Removed missing-file entry:",
            getTargetPath(download)
          );

          if (
            MAX_REMOVALS_PER_RUN > 0 &&
            removed >= MAX_REMOVALS_PER_RUN
          ) {
            console.warn(
              "[Hide Deleted Downloads] Test limit reached. " +
              "Click again to test another entry, or set " +
              "MAX_REMOVALS_PER_RUN = 0 for a full cleanup."
            );
            break;
          }
        } catch (error) {
          failed++;
          console.error(
            "[Hide Deleted Downloads] Could not safely remove entry:",
            getTargetPath(download),
            error
          );
        }
      }

      console.info(
        `[Hide Deleted Downloads] Finished. Removed: ${removed}; ` +
        `failed or uncertain: ${failed}.`
      );
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
    item.setAttribute(
      "tooltiptext",
      "Remove download entries whose target files are missing"
    );

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
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
