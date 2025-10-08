import { ArrayNotEmpty, IsArray, IsIn, IsUUID } from 'class-validator';

export const USER_SELECTABLE_FIELDS = [
  'id',
  'displayName',
  'email',
  'avatarUrl',
  'isActive',
  'createdAt',
  'updatedAt'
] as const;

export type UserSelectableField = (typeof USER_SELECTABLE_FIELDS)[number];

export class UserQueryDto {
  @IsUUID('4', { message: 'id must be a UUID' })
  id!: string;

  @IsArray({ message: 'fields must be an array' })
  @ArrayNotEmpty({ message: 'fields must contain at least one value' })
  @IsIn(USER_SELECTABLE_FIELDS, { each: true, message: 'fields contains an unsupported value' })
  fields!: UserSelectableField[];
}
