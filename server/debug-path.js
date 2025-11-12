import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('__dirname:', __dirname);
console.log('Expected model path:', path.join(__dirname, '../src/models/haarcascade_frontalface_default.xml'));
console.log('Actual file exists at expected location:', fs.existsSync(path.join(__dirname, '../src/models/haarcascade_frontalface_default.xml')));

// Check if we're in the right location relative to models
console.log('Checking models directory...');
const modelsDir = path.join(__dirname, '../src/models');
console.log('Models dir exists:', fs.existsSync(modelsDir));
if (fs.existsSync(modelsDir)) {
  console.log('Files in models dir:', fs.readdirSync(modelsDir));
}

// Check alternative paths
const possiblePaths = [
  path.join(__dirname, '../models/haarcascade_frontalface_default.xml'),
  path.join(process.cwd(), 'server/src/models/haarcascade_frontalface_default.xml'),
  path.join(process.cwd(), 'server/models/haarcascade_frontalface_default.xml'),
  './server/src/models/haarcascade_frontalface_default.xml'
];

console.log('\nChecking alternative paths:');
for (const testPath of possiblePaths) {
  console.log(`${testPath}: ${fs.existsSync(testPath)}`);
}