const path = require('path');
const esbuild = require(path.join(__dirname, '../node_modules/esbuild'));

async function main() {
  const entryPoint = path.join(__dirname, 'stress_physics_adversarial.ts');
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
  });

  const code = result.outputFiles[0].text;
  const fn = new Function('require', '__dirname', '__filename', code);
  fn(require, __dirname, entryPoint);
}

main().catch((err) => {
  console.error('Error running stress suite:', err);
  process.exit(1);
});
