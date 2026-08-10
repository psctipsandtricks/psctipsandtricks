import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { CreateChatGroupDto } from './dto/create-chat-group.dto';
import { UpdateChatGroupDto } from './dto/update-chat-group.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { UpdateMessageMetadataDto } from './dto/update-message-metadata.dto';

const MANAGE_CHAT_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @ApiOperation({ summary: 'List community chat groups (admin view, no per-user state)' })
  @Get('groups')
  async listGroups() {
    return this.chatService.listGroups();
  }

  @ApiOperation({ summary: 'List groups with the caller\'s joined/pinned/unread state' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('groups/mine')
  async listGroupsForUser(@Request() req: any) {
    return this.chatService.listGroupsForUser(req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Create a chat group (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Post('groups')
  async createGroup(@Body() dto: CreateChatGroupDto) {
    return this.chatService.createGroup(dto);
  }

  @ApiOperation({ summary: 'Upload/replace a group profile picture (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @UseInterceptors(FileInterceptor('file'))
  @Post('groups/:id/image')
  async uploadGroupImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.chatService.uploadGroupImage(id, file);
  }

  @ApiOperation({ summary: 'Update a chat group (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Patch('groups/:id')
  async updateGroup(@Param('id') id: string, @Body() dto: UpdateChatGroupDto) {
    return this.chatService.updateGroup(id, dto);
  }

  @ApiOperation({ summary: 'Toggle a chat group locked/unlocked (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Patch('groups/:id/lock')
  async toggleLock(@Param('id') id: string) {
    return this.chatService.toggleLock(id);
  }

  @ApiOperation({ summary: 'Delete a chat group (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Delete('groups/:id')
  async removeGroup(@Param('id') id: string) {
    return this.chatService.removeGroup(id);
  }

  @ApiOperation({ summary: 'Join a chat group' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('groups/:id/join')
  async joinGroup(@Request() req: any, @Param('id') id: string) {
    return this.chatService.joinGroup(id, req.user.id);
  }

  @ApiOperation({ summary: 'Leave a chat group' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('groups/:id/leave')
  async leaveGroup(@Request() req: any, @Param('id') id: string) {
    return this.chatService.leaveGroup(id, req.user.id);
  }

  @ApiOperation({ summary: 'Pin a chat group (max 3 per user)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('groups/:id/pin')
  async pinGroup(@Request() req: any, @Param('id') id: string) {
    return this.chatService.pinGroup(id, req.user.id);
  }

  @ApiOperation({ summary: 'Unpin a chat group' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('groups/:id/pin')
  async unpinGroup(@Request() req: any, @Param('id') id: string) {
    return this.chatService.unpinGroup(id, req.user.id);
  }

  @ApiOperation({ summary: 'Get messages in a group (paginated, newest last)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('groups/:id/messages')
  async getGroupMessages(
    @Param('id') id: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getGroupMessages(id, before, limit ? parseInt(limit, 10) : undefined);
  }

  @ApiOperation({ summary: 'Send a message to a group (must be a member)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('groups/:id/messages')
  async sendGroupMessage(@Request() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const message = await this.chatService.sendGroupMessage(
      id,
      req.user.id,
      req.user.name,
      dto,
      req.user.role,
    );
    this.chatGateway.broadcastGroupMessage(id, message);
    return message;
  }

  @ApiOperation({ summary: 'Mark a group as read up to a given message' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('groups/:id/read')
  async markRead(@Request() req: any, @Param('id') id: string, @Body() dto: MarkReadDto) {
    return this.chatService.markRead(id, req.user.id, dto.lastReadMessageId);
  }

  @ApiOperation({ summary: 'Update a message\'s metadata (reactions, poll votes) — must be a group member' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('messages/:id/metadata')
  async updateMessageMetadata(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateMessageMetadataDto) {
    return this.chatService.updateMessageMetadata(id, req.user.id, dto.metadata);
  }

  @ApiOperation({ summary: 'List a group\'s members (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Get('groups/:id/members')
  async listGroupMembers(@Param('id') id: string) {
    return this.chatService.listGroupMembers(id);
  }

  @ApiOperation({ summary: 'Remove a member from a group (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Delete('groups/:id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.chatService.removeMember(id, userId);
  }

  @ApiOperation({ summary: 'Post an admin announcement to a group (Admin / Staff with manage_chat, bypasses membership)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Post('groups/:id/announce')
  async postAnnouncement(@Request() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const message = await this.chatService.postAnnouncement(id, req.user.id, req.user.name, dto);
    this.chatGateway.broadcastGroupMessage(id, message);
    return message;
  }

  @ApiOperation({ summary: 'Get recent messages in a legacy room' })
  @Get('messages/:room')
  async getMessages(@Param('room') room: string) {
    return this.chatService.getRecentMessages(room);
  }

  @ApiOperation({ summary: 'Delete/moderate a chat message (Admin / Staff with manage_chat)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_CHAT_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageChat')
  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string) {
    return this.chatService.deleteMessage(id);
  }
}
