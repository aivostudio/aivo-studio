// ======================================================
// AIVO STUDIO – PAGE & MENU CONTROLLER (FINAL STABLE)
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  const pages = document.querySelectorAll(".page");
  const pageLinks = document.querySelectorAll("[data-page-link]");
  const musicTabs = document.querySelectorAll("[data-music-tab]");
  const musicViews = document.querySelectorAll(".music-view");

  // ----------------------------------
  // PAGE SWITCH
  // ----------------------------------
  function switchPage(target) {
    pages.forEach((page) => {
      page.classList.toggle("is-active", page.dataset.page === target);
    });

    pageLinks.forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        btn.dataset.pageLink === target
      );
    });

    // Sayfa değişince scroll reset
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ----------------------------------
  // MUSIC TAB SWITCH
  // ----------------------------------
  function switchMusicTab(tab) {
    musicTabs.forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        btn.dataset.musicTab === tab
      );
    });

    musicViews.forEach((view) => {
      view.classList.toggle(
        "is-active",
        view.dataset.musicView === tab
      );
    });
  }

  // ----------------------------------
  // PAGE LINK EVENTS
  // ----------------------------------
  pageLinks.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.dataset.pageLink;
      if (!target) return;

      switchPage(target);

      // Müzik sayfasına girince varsayılan tab
      if (target === "music") {
        switchMusicTab("geleneksel");
      }
    });
  });

  // ----------------------------------
  // MUSIC TAB EVENTS
  // ----------------------------------
  musicTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.musicTab;
      if (!tab) return;
      switchMusicTab(tab);
    });
  });

  // ----------------------------------
  // 🚀 INITIAL LOAD (FIRST OPEN)
  // ----------------------------------
  switchPage("music");
  switchMusicTab("geleneksel");
});
