import { IsOptional, IsUUID } from 'class-validator';

export class AssignCategoryDto {
  /** null / omitted clears the category assignment */
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}
