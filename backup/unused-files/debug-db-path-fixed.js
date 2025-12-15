import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../data/visitors.db');
const dataDir = path.dirname(dbPath);

console.log('Current directory:', __dirname);
console.log('DB Path:', dbPath);
console.log('Data Dir:', dataDir);
console.log('Expected data dir:', '/Users/baruntayenjam/Code/home-security/server/data');