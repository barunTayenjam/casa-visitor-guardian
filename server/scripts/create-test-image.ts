import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsDir = path.join(__dirname, '../public/events');

async function createTestImage() {
  console.log('Creating test image...');

  const width = 640;
  const height = 480;

  const svgImage = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="grey" />
      <circle cx="220" cy="200" r="40" fill="white" />
      <circle cx="420" cy="200" r="40" fill="white" />
      <circle cx="220" cy="200" r="10" fill="black" />
      <circle cx="420" cy="200" r="10" fill="black" />
      <path d="M 220 300 Q 320 400 420 300" stroke="black" fill="transparent" stroke-width="5" />
    </svg>
  `;

  const imageBuffer = await sharp(Buffer.from(svgImage)).toFormat('jpeg').toBuffer();

  const timestamp = Date.now();
  const filename = `test-face_cam1_${timestamp}.jpg`;
  const filepath = path.join(eventsDir, filename);

  fs.writeFileSync(filepath, imageBuffer);

  console.log(`Created test image: ${filename}`);
}

createTestImage().catch(console.error);
