import { resolve } from 'node:path';
import { normalizePath, type InlineConfig } from 'vite';
import desktopConfig from '../electron.vite.config';

export async function webuiConfig(root: string, outDir: string): Promise<InlineConfig> {
  const config =
    typeof desktopConfig === 'function'
      ? await desktopConfig({ command: 'build', mode: 'production' })
      : await desktopConfig;
  const renderer = config.renderer!;
  const originalI18n = normalizePath(resolve(root, 'packages/desktop/src/renderer/services/i18n/index.ts'));
  const koreanI18n = normalizePath(resolve(root, 'packages/desktop/src/renderer/pages/login/webuiI18n.ts'));
  return {
    ...renderer,
    configFile: false,
    root: resolve(root, 'packages/desktop/src/renderer/pages/login'),
    base: '/',
    plugins: [
      {
        name: 'webui-korean-only',
        enforce: 'pre',
        load(id) {
          if (normalizePath(id) === originalI18n) {
            return `export { default } from ${JSON.stringify(koreanI18n)}; export * from ${JSON.stringify(koreanI18n)};`;
          }
          return null;
        },
      },
      ...(renderer.plugins ?? []),
    ],
    define: { ...renderer.define, __AIONUI_WEB_ENTRY__: 'true' },
    build: {
      ...renderer.build,
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      manifest: true,
      rollupOptions: {
        input: resolve(root, 'packages/desktop/src/renderer/pages/login/webui.html'),
        external: ['node:crypto', 'crypto'],
      },
    },
  };
}
