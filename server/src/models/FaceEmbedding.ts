import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('face_embeddings')
@Index(['visitorId'])
@Index(['isActive'])
@Index(['qualityScore'])
@Index(['cameraId'])
@Index(['visitorId', 'qualityScore'])
export class FaceEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'visitor_id', type: 'text' })
  visitorId!: string;

  @Column({
    name: 'embedding_vector',
    type: 'real',
    array: true
  })
  embeddingVector!: number[];

  @Column({ name: 'quality_score', type: 'float' })
  qualityScore!: number;

  @Column({ name: 'sharpness', type: 'float', nullable: true })
  sharpness!: number | null;

  @Column({ name: 'brightness', type: 'float', nullable: true })
  brightness!: number | null;

  @Column({ name: 'face_width', type: 'integer' })
  faceWidth!: number;

  @Column({ name: 'face_height', type: 'integer' })
  faceHeight!: number;

  @Column({ name: 'face_area', type: 'integer' })
  faceArea!: number;

  @Column({ name: 'face_confidence', type: 'float' })
  faceConfidence!: number;

  @Column({ name: 'camera_id', type: 'text' })
  cameraId!: string;

  @Column({ name: 'image_path', type: 'text' })
  imagePath!: string;

  @Column({ name: 'detection_method', type: 'text' })
  detectionMethod!: string;

  @Column({ name: 'embedding_version', type: 'text', default: '128' })
  embeddingVersion!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
