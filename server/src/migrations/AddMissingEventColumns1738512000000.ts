import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingEventColumns1738512000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add missing columns to events table for proper detection tracking
        await queryRunner.query(`
            ALTER TABLE events
            ADD COLUMN IF NOT EXISTS confidence float DEFAULT 0,
            ADD COLUMN IF NOT EXISTS persons_detected integer DEFAULT 0,
            ADD COLUMN IF NOT EXISTS faces_detected integer DEFAULT 0,
            ADD COLUMN IF NOT EXISTS known_faces_count integer DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unknown_faces_count integer DEFAULT 0,
            ADD COLUMN IF NOT EXISTS object_detections jsonb DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS face_detections jsonb DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns if rolling back
        await queryRunner.query(`
            ALTER TABLE events
            DROP COLUMN IF EXISTS confidence,
            DROP COLUMN IF EXISTS persons_detected,
            DROP COLUMN IF EXISTS faces_detected,
            DROP COLUMN IF EXISTS known_faces_count,
            DROP COLUMN IF EXISTS unknown_faces_count,
            DROP COLUMN IF EXISTS object_detections,
            DROP COLUMN IF EXISTS face_detections,
            DROP COLUMN IF EXISTS created_at
        `);
    }
}
