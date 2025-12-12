import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateEventsTable1702340575345 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "events",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid",
                },
                {
                    name: "event_type",
                    type: "varchar",
                    length: "50",
                },
                {
                    name: "file_path",
                    type: "varchar",
                    length: "255",
                },
                {
                    name: "thumbnail_path",
                    type: "varchar",
                    length: "255",
                    isNullable: true,
                },
                {
                    name: "timestamp",
                    type: "timestamp",
                    default: "now()",
                },
                {
                    name: "camera_id",
                    type: "varchar",
                    length: "100",
                    isNullable: true,
                },
                {
                    name: "metadata",
                    type: "text",
                    isNullable: true,
                },
            ],
            indices: [
                {
                    name: "IDX_event_type",
                    columnNames: ["event_type"],
                },
                {
                    name: "IDX_timestamp",
                    columnNames: ["timestamp"],
                },
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("events");
    }

}
