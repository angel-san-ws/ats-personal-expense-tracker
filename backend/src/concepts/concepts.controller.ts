import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ConceptsService } from './concepts.service';
import { AssignCategoryDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('concepts')
export class ConceptsController {
  constructor(private readonly concepts: ConceptsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.concepts.findAll(user.userId);
  }

  @Patch(':id/category')
  assignCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignCategoryDto,
  ) {
    return this.concepts.assignCategory(user.userId, id, dto);
  }
}
