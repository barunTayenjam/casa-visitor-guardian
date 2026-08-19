import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
@Index(['userId', 'createdAt'])
export class ChatLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  role!: 'user' | 'assistant';

  @Column({ type: 'text', nullable: true })
  tool!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  params!: Record<string, unknown> | null;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
