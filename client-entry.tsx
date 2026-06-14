import { remarkToc } from './src/remark-toc';
import './src/styles/toc.css';

import type { GrowiFacade, OptionsGenerators, RendererOptions } from './src/types';

declare const growiFacade: GrowiFacade;

type SavedState = {
  optionsGenerators: OptionsGenerators;
  original: OptionsGenerators['customGenerateViewOptions'];
};

let savedState: SavedState | null = null;

const activate = (): void => {
  if (growiFacade == null || growiFacade.markdownRenderer == null) {
    // eslint-disable-next-line no-console
    console.warn('[growi-plugin-toc] growiFacade.markdownRenderer is not available');
    return;
  }

  const { optionsGenerators } = growiFacade.markdownRenderer;
  const original = optionsGenerators.customGenerateViewOptions;
  savedState = { optionsGenerators, original };

  optionsGenerators.customGenerateViewOptions = (...args: unknown[]): RendererOptions => {
    const options: RendererOptions = original != null
      ? original(...args)
      : optionsGenerators.generateViewOptions(...args);

    options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkToc];
    return options;
  };
};

const deactivate = (): void => {
  if (savedState == null) return;
  savedState.optionsGenerators.customGenerateViewOptions = savedState.original;
  savedState = null;
};

if (window.pluginActivators == null) {
  window.pluginActivators = {};
}

window.pluginActivators['growi-plugin-toc'] = {
  activate,
  deactivate,
};

export {};
