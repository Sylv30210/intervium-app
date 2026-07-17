try {
    const theme = localStorage.getItem("noverys_visual_theme") || localStorage.getItem("intervium_visual_theme");
    if (["glass", "dark"].includes(theme)) {
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.add(`theme-${theme}`);
        document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0b1120" : "#e9f1fb";
    }
} catch {}
