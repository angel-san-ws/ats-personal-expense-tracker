import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('excel')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('suggestCategories') suggestCategories?: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file was uploaded (field name: "file").',
      );
    }
    const name = (file.originalname || '').toLowerCase();
    if (!/\.(xls|xlsx|xlsm|csv)$/.test(name)) {
      throw new BadRequestException(
        'Unsupported file type. Upload an .xls, .xlsx or .csv file.',
      );
    }
    return this.importService.importExcel(
      user.userId,
      file.originalname,
      file.buffer,
      suggestCategories === 'true' || suggestCategories === '1',
    );
  }

  @Get('batches')
  batches(@CurrentUser() user: AuthUser) {
    return this.importService.listBatches(user.userId);
  }

  @Delete('batches/:id')
  deleteBatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.importService.deleteBatch(user.userId, id);
  }
}
