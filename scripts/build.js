const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['./src/index.ts'],
    outdir: './dist',
    bundle: true,
    format: 'cjs',
    platform: 'node',
})