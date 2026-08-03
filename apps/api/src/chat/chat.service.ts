import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(data: { userId: string; userName: string; content: string; room?: string }) {
    return this.prisma.chatMessage.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        content: data.content,
        room: data.room || 'general',
      },
    });
  }

  async getRecentMessages(room = 'general') {
    return this.prisma.chatMessage.findMany({
      where: { room },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
