import fs from 'fs';
import path from 'path';

const srcDir = './node_modules/@docmentis/udoc-viewer/dist/src';
const destDir = './public/udoc-viewer';

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      // Exclude source maps and declaration files to reduce file count
      if (entry.name.endsWith('.map') || entry.name.endsWith('.d.ts')) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  if (fs.existsSync(srcDir)) {
    copyDir(srcDir, destDir);
    
    // Explicitly copy critical files to the root of destDir to support different UDocClient loading strategies
    const criticalFiles = [
      { src: 'worker/worker.js', dest: 'worker.js' },
      { src: 'wasm/udoc_bg.wasm', dest: 'udoc_bg.wasm' },
      { src: 'worker/WorkerClient.js', dest: 'WorkerClient.js' },
      { src: 'wasm/udoc.js', dest: 'udoc.js' }
    ];
    
    for (const file of criticalFiles) {
      const fullSrc = path.join(srcDir, file.src);
      const fullDest = path.join(destDir, file.dest);
      if (fs.existsSync(fullSrc)) {
        fs.copyFileSync(fullSrc, fullDest);
      }
    }
    
    console.log('Full assets copy completed and critical files flattened.');
  } else {
    console.error('Source directory not found:', srcDir);
  }
} catch (err) {
  console.error('Error copying assets:', err);
}
