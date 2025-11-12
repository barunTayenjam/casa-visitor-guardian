import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/visitors.db');
const dataDir = path.dirname(dbPath);

console.log('Current directory:', __dirname);
console.log('DB Path:', dbPath);
console.log('Data Dir:', dataDir);
console.log('Data dir exists:', fs.existsSync(dataDir));

if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory...');
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Data directory created');
}

console.log('Final check - file exists:', fs.existsSync(dbPath));