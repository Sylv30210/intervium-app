const THEME_STORAGE_KEY = "intervium_visual_theme";
const FUTURE_THEME_STORAGE_KEY = "noverys_visual_theme";

export function storedTheme() {
    try { return localStorage.getItem(FUTURE_THEME_STORAGE_KEY) || localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
}

export function applyStoredTheme() {
    const stored = storedTheme();
    const theme = ["glass", "dark"].includes(stored) ? stored : "classic";
    if (theme !== "classic") document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.toggle("theme-glass", theme === "glass");
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
        themeColor = document.createElement("meta");
        themeColor.name = "theme-color";
        document.head.append(themeColor);
    }
    themeColor.content = theme === "dark" ? "#0b1120" : theme === "glass" ? "#e9f1fb" : "#f3f6fb";
    return theme;
}

export function setTheme(theme) {
    const value = ["glass", "dark"].includes(theme) ? theme : "classic";
    try {
        if (value !== "classic") { localStorage.setItem(THEME_STORAGE_KEY, value); localStorage.setItem(FUTURE_THEME_STORAGE_KEY, value); }
        else { localStorage.removeItem(THEME_STORAGE_KEY); localStorage.removeItem(FUTURE_THEME_STORAGE_KEY); }
    } catch {}
    return applyStoredTheme();
}
