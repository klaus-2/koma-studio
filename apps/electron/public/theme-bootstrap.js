(function () {
  try {
    var raw = localStorage.getItem('koma_theme');
    var parsed = raw ? JSON.parse(raw) : null;
    var state = (parsed && parsed.state) || {};
    var version = (parsed && parsed.version) || 0;
    var theme = state.theme === 'light' ? 'light' : 'dark';
    var family =
      version < 2 ? 'noir' : state.family === 'classic' ? 'classic' : 'noir';
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-family', family);
    root.classList.add(theme);
    if (
      family === 'noir' &&
      typeof state.noirAccent === 'string' &&
      /^#[0-9a-f]{6}$/i.test(state.noirAccent.trim())
    ) {
      root.style.setProperty('--noir-crimson', state.noirAccent.trim().toLowerCase());
    }
    root.style.backgroundColor =
      family === 'noir'
        ? theme === 'light'
          ? '#f2ede3'
          : '#07070c'
        : theme === 'light'
          ? '#f0f2f5'
          : '#060810';
  } catch {
    return;
  }
})();
