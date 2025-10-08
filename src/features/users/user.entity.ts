import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('users_display_name_idx')
  @Column({ name: 'display_name', type: 'varchar', length: 128 })
  displayName!: string;

}
