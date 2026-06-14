export type RendererOptions = {
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  components?: Record<string, unknown>;
  remarkRehypeOptions?: Record<string, unknown>;
};

export type OptionsGenerators = {
  generateViewOptions: (...args: unknown[]) => RendererOptions;
  customGenerateViewOptions: ((...args: unknown[]) => RendererOptions) | undefined;
};

export type MarkdownRenderer = {
  optionsGenerators: OptionsGenerators;
};

export type GrowiFacade = {
  markdownRenderer: MarkdownRenderer | null;
};
