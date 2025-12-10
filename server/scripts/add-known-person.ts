import { facialRecognitionService } from '../src/detection/facialRecognition.js';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/faces.db');



async function addKnownPerson() {
  console.log('Adding known person...');

  // Wait for the facial recognition service to be ready
  await new Promise<void>((resolve) => {
    facialRecognitionService.once('ready', () => {
      console.log('Facial recognition service is ready.');
      resolve();
    });
  });

  const person = {
    name: 'John Doe',
    description: 'Test person',
    isFamily: true,
    isAuthorized: true,
  };

  const personId = await facialRecognitionService.addKnownPerson(person);
  console.log(`Added person ${person.name} with ID ${personId}`);

  // Add a mock embedding for this person
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  const embeddingId = `embedding_${Date.now()}`;
  const embedding = Array.from({ length: 128 }, () => Math.random());
  const createdAt = new Date().toISOString();

  await db.run(
    'INSERT INTO face_embeddings (id, person_id, embedding_data, created_at) VALUES (?, ?, ?, ?)',
    [embeddingId, personId, JSON.stringify(embedding), createdAt]
  );

  console.log(`Added mock embedding for ${person.name}`);

  await db.close();
}

addKnownPerson().catch(console.error);
