import { Module } from '@nestjs/common';
import { PdfHighlightsController } from './pdf-highlights.controller';
import { PdfHighlightsService } from './pdf-highlights.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PdfHighlightsController],
  providers: [PdfHighlightsService],
  exports: [PdfHighlightsService],
})
export class PdfHighlightsModule {}
