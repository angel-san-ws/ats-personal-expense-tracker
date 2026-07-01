import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concept } from './concept.entity';
import { ConceptsService } from './concepts.service';
import { ConceptsController } from './concepts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Concept])],
  providers: [ConceptsService],
  controllers: [ConceptsController],
  exports: [ConceptsService],
})
export class ConceptsModule {}
