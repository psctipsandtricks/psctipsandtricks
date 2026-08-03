import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BooksService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const book = await this.prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async create(data: any) {
    return this.prisma.book.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.book.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.book.delete({ where: { id } });
  }
}
