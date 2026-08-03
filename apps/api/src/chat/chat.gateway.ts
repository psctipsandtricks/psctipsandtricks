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
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
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
    @MessageBody() payload: { userId: string; userName: string; content: string; room?: string }
  ) {
    const room = payload.room || 'general';
    const message = await this.chatService.saveMessage(payload);
    this.server.to(room).emit('newChatMessage', message);
    return message;
  }

  @SubscribeMessage('quizBattleAnswer')
  handleQuizBattleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; userId: string; score: number }
  ) {
    this.server.to(payload.roomId).emit('battleProgressUpdate', payload);
  }

  // Method called from API to broadcast live mock test rank updates
  broadcastRankUpdate(quizId: string, leaderboard: any[]) {
    this.server.to(`quiz_${quizId}`).emit('liveMockRankUpdate', leaderboard);
  }
}
