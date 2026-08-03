import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BooksService } from './books.service';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @ApiOperation({ summary: 'List all published e-books' })
  @Get()
  async findAll() {
    return this.booksService.findAll();
  }

  @ApiOperation({ summary: 'Get details of a specific e-book' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new e-book (Admin)' })
  @Post()
  async create(@Body() body: any) {
    return this.booksService.create(body);
  }

  @ApiOperation({ summary: 'Update e-book (Admin)' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.booksService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete e-book (Admin)' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.booksService.remove(id);
  }
}
