import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  @Post('auto-categorize')
  autoCategorize(@CurrentUser() user: AuthUser) {
    return this.concepts.autoCategorize(user.userId);
  }

  /** Category suggestion for a merchant name (nothing is persisted). */
  @Get('suggest')
  async suggest(@CurrentUser() user: AuthUser, @Query('name') name: string) {
    const suggestion = await this.concepts.suggestForName(
      user.userId,
      name ?? '',
    );
    return { suggestion };
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
