import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Category } from './Category';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @ManyToOne(() => Category, (category) => category.documents)
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  category_id?: number;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'tsvector', nullable: true, select: false })
  search_vector?: any;
}