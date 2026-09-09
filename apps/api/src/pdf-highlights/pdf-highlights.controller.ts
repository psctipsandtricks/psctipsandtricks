import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PdfHighlightsService } from './pdf-highlights.service';
import { CreatePdfHighlightDto } from './dto/create-pdf-highlight.dto';
import { ErasePdfHighlightsDto } from './dto/erase-pdf-highlights.dto';

/**
 * Marker strokes on book PDFs, so a highlight made on the phone is on the
 * website too.
 *
 * There is no admin view and no "all highlights" route on purpose: these are
 * private annotations, and the only reader of a student's marks is that
 * student.
 */
@ApiTags('PDF Highlights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pdf-highlights')
export class PdfHighlightsController {
  constructor(private readonly service: PdfHighlightsService) {}

  @ApiOperation({ summary: "The caller's highlights on one document" })
  @Get()
  async list(@Request() req: any, @Query('documentKey') documentKey?: string) {
    if (!documentKey) return [];
    return this.service.list(req.user.id, documentKey);
  }

  @ApiOperation({ summary: 'Save one marker stroke' })
  @Post()
  async create(@Request() req: any, @Body() dto: CreatePdfHighlightDto) {
    return this.service.create(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Erase strokes by id (a batch — one swipe can cross several)' })
  @Post('erase')
  async erase(@Request() req: any, @Body() dto: ErasePdfHighlightsDto) {
    return this.service.erase(req.user.id, dto.ids);
  }
}
