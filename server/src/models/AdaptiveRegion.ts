import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('adaptive_regions')
export class AdaptiveRegion {
  @PrimaryColumn({ type: 'varchar', length: 20, comment: 'Camera name' })
  camera!: string;

  @Column({ type: 'jsonb', default: { cells: [], last_update: null }, comment: 'Region grid data' })
  grid!: {
    cells: string[];
    last_update: string | null;
  };

  @UpdateDateColumn({ name: 'last_update', comment: 'Last grid update' })
  last_update!: Date;
}
