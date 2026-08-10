import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageType, UserRole } from '@prisma/client';

interface AuthedSocketData {
  userId: string;
  userName: string;
  role: UserRole;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private socketUsers = new Map<string, AuthedSocketData>();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization?.toString().replace('Bearer ', '') ?? '');

    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket connection: ${client.id}`);
      client.emit('error', { message: 'Authentication required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'super-secret-psc-jwt-key-2026',
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status === 'SUSPENDED') {
        throw new Error('Invalid user');
      }
      this.socketUsers.set(client.id, { userId: user.id, userName: user.name, role: user.role });
      this.logger.log(`Client connected: ${client.id} (${user.name})`);
    } catch {
      this.logger.warn(`Rejected socket with invalid token: ${client.id}`);
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.socketUsers.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody('room') room: string) {
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    return { event: 'joinedRoom', room };
  }

  @SubscribeMessage('sendChatMessage')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { content: string; room?: string; groupId?: string; messageType?: ChatMessageType; mediaUrl?: string },
  ) {
    const authedUser = this.socketUsers.get(client.id);
    if (!authedUser) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const requestedType = payload.messageType || ChatMessageType.TEXT;
    if (requestedType !== ChatMessageType.TEXT) {
      const allowed = await this.chatService.canModerate(authedUser.userId, authedUser.role);
      if (!allowed) {
        client.emit('error', { message: 'Only moderators can post polls, images, or documents' });
        return;
      }
    }

    if (payload.groupId) {
      const isMember = await this.chatService.isMember(payload.groupId, authedUser.userId);
      if (!isMember) {
        client.emit('error', { message: 'You must join this group before sending messages' });
        return;
      }
      const isModerator = await this.chatService.canModerate(authedUser.userId, authedUser.role);
      try {
        await this.chatService.assertGroupFeatureAllowed(
          payload.groupId,
          isModerator,
          requestedType === ChatMessageType.TEXT ? 'text' : 'poll',
        );
      } catch (err: any) {
        client.emit('error', { message: err?.message || 'This action is disabled for the group' });
        return;
      }
    }

    const room = payload.room || 'general';
    const message = await this.chatService.saveMessage({
      userId: authedUser.userId,
      userName: authedUser.userName,
      content: payload.content,
      room,
      groupId: payload.groupId,
      messageType: requestedType,
      mediaUrl: payload.mediaUrl,
    });
    this.server.to(room).emit('newChatMessage', message);
    if (payload.groupId) this.broadcastGroupMessage(payload.groupId, message);
    return message;
  }

  /**
   * Push a message to everyone viewing a group. Called by the REST controller so
   * that messages sent over HTTP still reach open clients in realtime, which is
   * what lets the web app drop its polling interval.
   */
  broadcastGroupMessage(groupId: string, message: unknown) {
    this.server.to(`group:${groupId}`).emit('newChatMessage', message);
  }

  @SubscribeMessage('quizBattleAnswer')
  handleQuizBattleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; userId: string; score: number },
  ) {
    this.server.to(payload.roomId).emit('battleProgressUpdate', payload);
  }

  // Method called from API to broadcast live mock test rank updates
  broadcastRankUpdate(quizId: string, leaderboard: any[]) {
    this.server.to(`quiz_${quizId}`).emit('liveMockRankUpdate', leaderboard);
  }

  // Method called from API to broadcast scheduled mock-test rank updates
  broadcastMockTestRankUpdate(mockTestId: string, leaderboard: any[]) {
    this.server.to(`mocktest_${mockTestId}`).emit('liveMockRankUpdate', leaderboard);
  }
}
