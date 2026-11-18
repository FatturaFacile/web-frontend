/*
 * Applies the saved theme, density, motion preference and tenant brand colours to <html> before the first paint, so a
 * cold refresh never flashes the wrong theme. It reads the cache written by UiPreferencesService (localStorage
 * `ff_ui`) and ThemeService (`ff_ui_brand`); ThemeService takes over once Angular has started.
 * Keep the rules in step with UiPreferencesService.resolvedTheme.
 */
(function () {
  try {
    var win = window;
    var root = document.documentElement;
    var store = win.localStorage;
    var ui = JSON.parse(store.getItem('ff_ui') || '{}') || {};
    var themes = ['light', 'dark', 'system'];
    var densities = ['compact', 'comfortable', 'spacious'];

    var theme =
      themes.indexOf(ui.theme) >= 0
        ? ui.theme
        : store.getItem('theme') || store.getItem('ff_theme') || 'system';
    if (theme === 'system') {
      var tenantDefault = ui.branding && ui.branding.default_theme;
      theme = tenantDefault === 'light' || tenantDefault === 'dark' ? tenantDefault : 'system';
    }
    var dark =
      theme === 'dark' ||
      (theme !== 'light' &&
        !!win.matchMedia &&
        win.matchMedia('(prefers-color-scheme: dark)').matches);
    var mode = dark ? 'dark' : 'light';

    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
    if (dark) {
      root.classList.add('dark');
    }
    var storedDensity = ui.density || store.getItem('ff-density');
    root.setAttribute(
      'data-density',
      densities.indexOf(storedDensity) >= 0 ? storedDensity : 'comfortable',
    );
    var brandAccents = ['teal', 'indigo', 'purple', 'amber'];
    var storedBrandAccent = store.getItem('ff-brand');
    root.setAttribute(
      'data-brand',
      brandAccents.indexOf(storedBrandAccent) >= 0 ? storedBrandAccent : 'teal',
    );

    var reduced =
      typeof ui.reducedMotion === 'boolean'
        ? ui.reducedMotion
        : !!win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.setAttribute('data-reduced-motion', String(reduced));

    var brand = JSON.parse(store.getItem('ff_ui_brand') || 'null');
    var variables = brand && brand[mode];
    if (variables) {
      for (var name in variables) {
        if (Object.prototype.hasOwnProperty.call(variables, name) && name.indexOf('--ff-') === 0) {
          root.style.setProperty(name, String(variables[name]));
        }
      }
    }

    if (dark) {
      var link = document.createElement('link');
      link.id = 'theme-dark-stylesheet';
      link.rel = 'stylesheet';
      link.href = 'theme-dark.css';
      document.head.appendChild(link);
    }
  } catch (e) {
    /* Storage blocked or damaged: the light theme and the defaults apply. */
  }
})();
