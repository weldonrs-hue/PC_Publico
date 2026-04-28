import fs from 'fs';
import path from 'path';

const publicDir = './public';
const files = fs.readdirSync(publicDir);

files.forEach(file => {
  const filePath = path.join(publicDir, file);
  const stats = fs.statSync(filePath);
  console.log(`${file}: ${stats.size} bytes`);
});
