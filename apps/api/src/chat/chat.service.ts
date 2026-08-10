import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ChatMessageType, UserRole } from '@prisma/client';
import { CreateChatGroupDto } from './dto/create-chat-group.dto';
import { UpdateChatGroupDto } from './dto/update-chat-group.dto';
import { SendMessageDto } from './dto/send-message.dto';

const MAX_PINS = 3;

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async saveMessage(data: {
    userId: string;
    userName: string;
    content: string;
    room?: string;
    groupId?: string;
    messageType?: ChatMessageType;
    mediaUrl?: string;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.chatMessage.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        content: data.content,
        room: data.room || 'general',
        groupId: data.groupId,
        messageType: data.messageType || ChatMessageType.TEXT,
        mediaUrl: data.mediaUrl,
        metadata: data.metadata,
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

  async canModerate(userId: string, role: UserRole): Promise<boolean> {
    if (role === UserRole.ADMIN) return true;
    if (role !== UserRole.STAFF) return false;
    const permission = await this.prisma.staffPermission.findUnique({ where: { userId } });
    return !!permission?.manageChat;
  }

  async deleteMessage(id: string) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.chatMessage.delete({ where: { id } });
  }

  async listGroups() {
    return this.prisma.chatGroup.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGroup(dto: CreateChatGroupDto) {
    return this.prisma.chatGroup.create({ data: dto });
  }

  /** Stores a group's profile picture and points the group at it. */
  async uploadGroupImage(id: string, file: Express.Multer.File) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Chat group not found');
    if (!file) throw new BadRequestException('No image file provided');

    const url = await this.storageService.upload(
      'group-images',
      `${id}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return this.prisma.chatGroup.update({ where: { id }, data: { imageUrl: url } });
  }

  async updateGroup(id: string, dto: UpdateChatGroupDto) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Chat group not found');
    return this.prisma.chatGroup.update({ where: { id }, data: dto });
  }

  async toggleLock(id: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Chat group not found');
    return this.prisma.chatGroup.update({ where: { id }, data: { isLocked: !group.isLocked } });
  }

  async removeGroup(id: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Chat group not found');
    return this.prisma.chatGroup.delete({ where: { id } });
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return !!membership;
  }

  async listGroupsForUser(userId: string, userRole?: UserRole) {
    // Locked groups are admin-only workspaces — students shouldn't see them at all.
    const isModerator = userRole ? await this.canModerate(userId, userRole) : false;
    const groups = await this.prisma.chatGroup.findMany({
      where: isModerator ? undefined : { isLocked: false },
      include: {
        _count: { select: { members: true } },
        members: { where: { userId }, select: { id: true } },
        pins: { where: { userId }, select: { id: true } },
        reads: { where: { userId }, select: { lastReadAt: true, lastReadMessageId: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Unread counts for every group in a single grouped query, rather than one
    // COUNT per group (which made this endpoint scale linearly with group count).
    const readAtByGroup = new Map<string, Date | undefined>(
      groups.map((g) => [g.id, g.reads[0]?.lastReadAt]),
    );
    const unreadRows = await this.prisma.chatMessage.groupBy({
      by: ['groupId'],
      where: {
        OR: groups.map((g) => ({
          groupId: g.id,
          ...(readAtByGroup.get(g.id) ? { createdAt: { gt: readAtByGroup.get(g.id) } } : {}),
        })),
      },
      _count: { _all: true },
    });
    const unreadByGroup = new Map(unreadRows.map((r) => [r.groupId, r._count._all]));

    return groups.map((g) => {
      const readRecord = g.reads[0];
      const { members, pins, reads, messages, ...groupFields } = g;
      return {
        ...groupFields,
        memberCount: g._count.members,
        isJoined: members.length > 0,
        isPinned: pins.length > 0,
        unreadCount: unreadByGroup.get(g.id) ?? 0,
        lastReadMessageId: readRecord?.lastReadMessageId || null,
        lastMessage: messages[0] || null,
      };
    });
  }

  /**
   * Throws when a non-moderator tries to use a feature the admin has disabled
   * for this group. Moderators are always allowed so they can still run the group.
   */
  async assertGroupFeatureAllowed(
    groupId: string,
    isModerator: boolean,
    kind: 'text' | 'poll',
  ) {
    if (isModerator) return;
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { allowTextMessages: true, allowPolls: true },
    });
    if (!group) throw new NotFoundException('Chat group not found');
    if (kind === 'text' && !group.allowTextMessages) {
      throw new BadRequestException('Text messages are disabled for this group');
    }
    if (kind === 'poll' && !group.allowPolls) {
      throw new BadRequestException('Polls are disabled for this group');
    }
  }

  async joinGroup(groupId: string, userId: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');
    return this.prisma.chatGroupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
    });
  }

  async leaveGroup(groupId: string, userId: string) {
    await this.prisma.chatGroupMember.deleteMany({ where: { groupId, userId } });
    return { groupId, left: true };
  }

  async pinGroup(groupId: string, userId: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');

    const existing = await this.prisma.chatGroupPin.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (existing) return existing;

    const pinCount = await this.prisma.chatGroupPin.count({ where: { userId } });
    if (pinCount >= MAX_PINS) {
      throw new BadRequestException(`You can only pin up to ${MAX_PINS} chats`);
    }

    return this.prisma.chatGroupPin.create({ data: { userId, groupId } });
  }

  async unpinGroup(groupId: string, userId: string) {
    await this.prisma.chatGroupPin.deleteMany({ where: { groupId, userId } });
    return { groupId, unpinned: true };
  }

  async getGroupMessages(groupId: string, before?: string, limit = 50) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        groupId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: { user: { select: { role: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse().map((m) => {
      const { user, ...rest } = m;
      return { ...rest, senderRole: user.role };
    });
  }

  async updateMessageMetadata(messageId: string, userId: string, metadata: Record<string, any>) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (!message.groupId) throw new BadRequestException('Cannot update a legacy room message');

    const isMember = await this.isMember(message.groupId, userId);
    if (!isMember) throw new BadRequestException('You must be a member of this group');

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { metadata: { ...(message.metadata as any), ...metadata } },
    });
  }

  async sendGroupMessage(
    groupId: string,
    userId: string,
    userName: string,
    dto: SendMessageDto,
    userRole?: UserRole,
  ) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');
    if (group.isLocked) throw new BadRequestException('This group is locked by an admin');

    const member = await this.isMember(groupId, userId);
    if (!member) throw new BadRequestException('You must join this group before sending messages');

    const isModerator = userRole ? await this.canModerate(userId, userRole) : false;
    await this.assertGroupFeatureAllowed(
      groupId,
      isModerator,
      dto.metadata?.poll ? 'poll' : 'text',
    );

    return this.saveMessage({
      userId,
      userName,
      content: dto.content,
      groupId,
      room: dto.room,
      messageType: dto.messageType,
      mediaUrl: dto.mediaUrl,
      metadata: dto.metadata,
    });
  }

  async markRead(groupId: string, userId: string, lastReadMessageId?: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');

    return this.prisma.chatGroupRead.upsert({
      where: { userId_groupId: { userId, groupId } },
      create: { userId, groupId, lastReadMessageId, lastReadAt: new Date() },
      update: { lastReadMessageId, lastReadAt: new Date() },
    });
  }

  async listGroupMembers(groupId: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');

    return this.prisma.chatGroupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async removeMember(groupId: string, userId: string) {
    await this.prisma.chatGroupMember.deleteMany({ where: { groupId, userId } });
    return { groupId, userId, removed: true };
  }

  // Admin/staff broadcast — bypasses the membership requirement and, when pinned,
  // unpins any other message currently pinned in the group (only one pin at a time).
  async postAnnouncement(groupId: string, adminUserId: string, adminUserName: string, dto: SendMessageDto) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');

    if (dto.metadata?.isPinned) {
      const pinnedMessages = await this.prisma.chatMessage.findMany({
        where: { groupId, metadata: { path: ['isPinned'], equals: true } },
      });
      await Promise.all(
        pinnedMessages.map((m) =>
          this.prisma.chatMessage.update({
            where: { id: m.id },
            data: { metadata: { ...(m.metadata as any), isPinned: false } },
          }),
        ),
      );
    }

    return this.saveMessage({
      userId: adminUserId,
      userName: adminUserName,
      content: dto.content,
      groupId,
      messageType: dto.messageType,
      mediaUrl: dto.mediaUrl,
      metadata: dto.metadata,
    });
  }
}
