import { remarkToc } from './src/remark-toc';
import './src/styles/toc.css';

import type { GrowiFacade, RendererOptions } from './src/types';

declare const growiFacade: GrowiFacade;

const activate = (): void => {
  if (growiFacade == null || growiFacade.markdownRenderer == null) {
    // eslint-disable-next-line no-console
    console.warn('[growi-plugin-toc] growiFacade.markdownRenderer is not available');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[growi-plugin-toc] activated');

  const { optionsGenerators } = growiFacade.markdownRenderer;
  const originalCustomViewOptions = optionsGenerators.customGenerateViewOptions;

  optionsGenerators.customGenerateViewOptions = (...args: unknown[]): RendererOptions => {
    const options: RendererOptions = originalCustomViewOptions != null
      ? originalCustomViewOptions(...args)
      : optionsGenerators.generateViewOptions(...args);

    options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkToc];
    // eslint-disable-next-line no-console
    console.log('[growi-plugin-toc] remarkPlugins extended', options.remarkPlugins.length);
    return options;
  };
};

const deactivate = (): void => {};

if ((window as any).pluginActivators == null) {
  (window as any).pluginActivators = {};
}

(window as any).pluginActivators['growi-plugin-toc'] = {
  activate,
  deactivate,
};

export {};
