import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('dist-electron', { recursive: true });
for (const [entry, out] of [
  ['electron/main.ts', 'main.cjs'],
  ['electron/preload.ts', 'preload.cjs'],
  ['electron/workers/simulation.ts', 'simulation.cjs'],
  ['electron/workers/writer.ts', 'writer.cjs'],
  ['electron/workers/export.ts', 'export.cjs']
]) {
  await build({ entryPoints: [entry], outfile: `dist-electron/${out}`, bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron', '@napi-rs/canvas', 'ffmpeg-static', 'ffprobe-static'], sourcemap: true });
}
