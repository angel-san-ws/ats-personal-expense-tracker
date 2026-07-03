import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  findAll(userId: string): Promise<Category[]> {
    return this.categories.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { id, userId } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    await this.assertNameFree(userId, dto.name);
    const category = this.categories.create({
      userId,
      name: dto.name.trim(),
      color: dto.color ?? '#6366f1',
    });
    return this.categories.save(category);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(userId, id);
    if (dto.name !== undefined && dto.name.trim() !== category.name) {
      await this.assertNameFree(userId, dto.name);
      category.name = dto.name.trim();
    }
    if (dto.color !== undefined) category.color = dto.color;
    return this.categories.save(category);
  }

  async remove(userId: string, id: string): Promise<void> {
    const category = await this.findOne(userId, id);
    // Concepts referencing this category are set to null via onDelete: SET NULL
    await this.categories.remove(category);
  }

  private async assertNameFree(userId: string, name: string): Promise<void> {
    const existing = await this.categories.findOne({
      where: { userId, name: name.trim() },
    });
    if (existing)
      throw new ConflictException('A category with that name already exists');
  }
}
