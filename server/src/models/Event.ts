
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('events')
@Index(['event_type'])
@Index(['timestamp'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ 
    type: 'varchar', 
    length: 50,
    comment: 'Type of event, e.g., motion, person, car'
  })
  event_type!: string;

  @Column({ 
    type: 'varchar',
    length: 255,
    comment: 'Path to the saved event file (image or video)'
  })
  file_path!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Path to a smaller thumbnail for the event'
  })
  thumbnail_path!: string | null;

  @CreateDateColumn()
  timestamp!: Date;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Identifier for the camera that triggered the event'
  })
  camera_id!: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Additional data about the event, as a JSON string'
  })
  metadata!: string | null;
}
