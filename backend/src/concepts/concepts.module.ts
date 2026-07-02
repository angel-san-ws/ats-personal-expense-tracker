import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concept } from './concept.entity';
import { Category } from '../categories/category.entity';
import { MerchantCategoryStat } from './merchant-category-stat.entity';
import { ConceptsService } from './concepts.service';
import { ConceptsController } from './concepts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concept, Category, MerchantCategoryStat]),
  ],
  providers: [ConceptsService],
  controllers: [ConceptsController],
  exports: [ConceptsService],
})
export class ConceptsModule {}
