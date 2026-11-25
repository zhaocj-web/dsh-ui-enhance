import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

// DSH 提供 React，必须保持 external，不能打包第二份运行时。
const common = { bundle: true, sourcemap: true, minify: false, target: 'es2022', write: false };
const host = await build({
  ...common,
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  platform: 'node',
  format: 'esm',
  packages: 'external',
});
const client = await build({
  ...common,
  entryPoints: ['src/client/plugin.tsx'],
  outfile: 'lib/client.js',
  platform: 'browser',
  format: 'cjs',
  external: ['react'],
  loader: { '.css': 'text' },
  banner: {
    js: 'window.__ModuleLoader__.load({id:"dsh-ui-enhance",factory:(require)=>{var module={exports:{}};var exports=module.exports;',
  },
  footer: { js: 'return module.exports;}});' },
});
// 所有构建成功后才更新安装目录，避免失败时留下不完整的插件。
await mkdir('lib', { recursive: true });
for (const output of [...host.outputFiles, ...client.outputFiles])
  await writeFile(output.path, output.contents);
