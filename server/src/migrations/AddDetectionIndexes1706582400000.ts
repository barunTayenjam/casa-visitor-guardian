import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddDetectionIndexes1706582400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add indexes to improve detection query performance
        await queryRunner.createIndex("events", new TableIndex({
            name: "IDX_events_camera_confidence_timestamp",
            columnNames: ["camera_id", "confidence", "timestamp"],
        }));

        await queryRunner.createIndex("events", new TableIndex({
            name: "IDX_events_event_type_timestamp",
            columnNames: ["event_type", "timestamp"],
        }));

        await queryRunner.createIndex("events", new TableIndex({
            name: "IDX_events_persons_detected_timestamp",
            columnNames: ["persons_detected", "timestamp"],
        }));

        await queryRunner.createIndex("events", new TableIndex({
            name: "IDX_events_faces_detected_timestamp",
            columnNames: ["faces_detected", "timestamp"],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the indexes
        await queryRunner.dropIndex("events", "IDX_events_camera_confidence_timestamp");
        await queryRunner.dropIndex("events", "IDX_events_event_type_timestamp");
        await queryRunner.dropIndex("events", "IDX_events_persons_detected_timestamp");
        await queryRunner.dropIndex("events", "IDX_events_faces_detected_timestamp");
    }

}