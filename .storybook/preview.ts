import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { applicationConfig, type Preview } from '@storybook/angular';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';

// Global toolbar: the same three axes the application exposes (light/dark mode, density, brand accent), applied as
// attributes on <html> exactly like ThemeService and DisplayPreferencesService do.
const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', icon: 'paintbrush', items: ['light', 'dark'], dynamicTitle: true },
    },
    density: {
      description: 'Density',
      toolbar: {
        title: 'Density',
        icon: 'component',
        items: ['compact', 'comfortable'],
        dynamicTitle: true,
      },
    },
    brand: {
      description: 'Brand accent',
      toolbar: {
        title: 'Brand',
        icon: 'star',
        items: ['teal', 'indigo', 'purple', 'amber'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', density: 'compact', brand: 'teal' },
  decorators: [
    applicationConfig({
      providers: [provideHttpClient(), provideAnimations(), provideNzI18n(en_US)],
    }),
    (story, context) => {
      const root = document.documentElement;
      const theme = context.globals['theme'] as string;
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
      root.setAttribute('data-density', context.globals['density'] as string);
      root.setAttribute('data-brand', context.globals['brand'] as string);
      document.body.style.background = 'var(--bg-primary)';
      document.body.style.color = 'var(--text-primary)';
      return story();
    },
  ],
  parameters: { layout: 'padded', a11y: { test: 'error' } },
};

export default preview;
