/*
   KŌMA pre-paint theme bootstrap. Runs synchronously (classic script,
   head) before any CSS/paint to avoid the light/dark flash. Kept as an
   external file because both shells ship CSP script-src 'self' (no
   inline). Mirrors the persisted shape of @koma/ui theme-store
   (zustand persist: { state: {...}, version }). applyTheme() clears the
   inline background once the themed stylesheet is live.
*/
(function () {
  try {
    var raw = localStorage.getItem('koma_theme');
    var state = (raw && JSON.parse(raw).state) || {};
    var theme = state.theme === 'light' ? 'light' : 'dark';
    var family = state.family === 'noir' ? 'noir' : 'classic';
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-family', family);
    root.classList.add(theme);
    // Pre-paint page background per family×mode (matches token values).
    root.style.backgroundColor =
      family === 'noir'
        ? theme === 'light'
          ? '#f2ede3'
          : '#07070c'
        : theme === 'light'
          ? '#f0f2f5'
          : '#060810';
  } catch {
    /* storage unavailable — defaults apply after hydration */
  }
})();
