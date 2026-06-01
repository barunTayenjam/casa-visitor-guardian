import { Router } from 'express';

class VisitorService {
  async getKnownPersons(): Promise<any[]> {
    const { AppDataSource } = await import('../database.js');
    const rows = await AppDataSource.query(
      "SELECT id, name, COALESCE(embedding_count, 0) as image_count, created_at, updated_at FROM visitors WHERE type = 'known' ORDER BY name ASC"
    );
    return rows.map((r: any) => ({
      id: r.id, name: r.name, imageCount: r.image_count,
      embeddingCount: r.image_count, createdAt: r.created_at, updatedAt: r.updated_at
    }));
  }

  async createPerson(name: string): Promise<string> {
    const { AppDataSource } = await import('../database.js');
    const id = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AppDataSource.query(
      'INSERT INTO visitors (id, name, type, first_seen, last_seen) VALUES ($1, $2, $3, NOW(), NOW())',
      [id, name, 'known']
    );
    return id;
  }

  async updatePerson(id: string, data: { name: string }): Promise<boolean> {
    const { AppDataSource } = await import('../database.js');
    const result = await AppDataSource.query(
      'UPDATE visitors SET name = $1, updated_at = NOW() WHERE id = $2',
      [data.name, id]
    );
    return (result.rowCount || 0) > 0;
  }

  async getKnownFaces(): Promise<any[]> {
    const { AppDataSource } = await import('../database.js');
    const rows = await AppDataSource.query(
      `SELECT v.id, v.name, v.embedding_count as image_count, v.updated_at as last_trained
       FROM visitors v WHERE v.type = 'known' AND v.embedding_count > 0 ORDER BY v.name ASC`
    );
    return rows.map((r: any) => ({
      id: r.id, name: r.name, imageCount: r.image_count, lastTrained: r.last_trained, personId: r.id
    }));
  }

  async deleteFace(personId: string): Promise<boolean> {
    const { AppDataSource } = await import('../database.js');
    await AppDataSource.query('DELETE FROM face_embeddings WHERE visitor_id = $1', [personId]);
    const visitorResult = await AppDataSource.query('DELETE FROM visitors WHERE id = $1', [personId]);
    return (visitorResult.rowCount || 0) > 0;
  }

  async registerFace(name: string): Promise<string> {
    const { AppDataSource } = await import('../database.js');
    const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AppDataSource.query(
      'INSERT INTO visitors (id, name, type, first_seen, last_seen) VALUES ($1, $2, $3, NOW(), NOW())',
      [personId, name, 'known']
    );
    return personId;
  }
}

const visitorService = new VisitorService();
export default visitorService;
