import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ChatMessageType, Prisma, UserRole } from '@prisma/client';
import { CreateChatGroupDto } from './dto/create-chat-group.dto';
import { UpdateChatGroupDto } from './dto/update-chat-group.dto';
import { SendMessageDto } from './dto/send-message.dto';

const MAX_PINS = 3;
const DEFAULT_MEMBER_PAGE_SIZE = 20;
const MAX_MEMBER_PAGE_SIZE = 100;

export type MemberStatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

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
      // Blocked members no longer participate, so they don't count as members.
      include: { _count: { select: { members: { where: { isBlocked: false } } } } },
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

  /** Stores a chat message attachment (PDF, Excel, Word, Image, Doc) uploaded by Admin. */
  async uploadAttachment(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'file';
    let fileType: 'pdf' | 'excel' | 'word' | 'image' | 'file' = 'file';
    if (ext === 'pdf') fileType = 'pdf';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'excel';
    else if (['doc', 'docx'].includes(ext)) fileType = 'word';
    else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) fileType = 'image';

    const formattedSize =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const url = await this.storageService.upload(
      'chat-attachments',
      `admin-uploads/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    return {
      name: file.originalname,
      url,
      type: fileType,
      size: formattedSize,
    };
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

  /** Blocked members are deliberately not "members" — every membership check treats them as outsiders. */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return !!membership && !membership.isBlocked;
  }

  /** Who a group notification should reach — active members only, same rule as `isMember`. */
  async getActiveMemberUserIds(groupId: string): Promise<string[]> {
    const members = await this.prisma.chatGroupMember.findMany({
      where: { groupId, isBlocked: false },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  async isBlocked(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { isBlocked: true },
    });
    return !!membership?.isBlocked;
  }

  private async assertNotBlocked(groupId: string, userId: string) {
    if (await this.isBlocked(groupId, userId)) {
      throw new ForbiddenException('You have been blocked from this group by an admin');
    }
  }

  async listGroupsForUser(userId: string, userRole?: UserRole) {
    // Locked groups are admin-only workspaces — students shouldn't see them at all.
    const isModerator = userRole ? await this.canModerate(userId, userRole) : false;
    const groups = await this.prisma.chatGroup.findMany({
      // A blocked student loses the group from their list entirely — it's not
      // just read-only for them, it's invisible.
      where: isModerator
        ? undefined
        : { isLocked: false, members: { none: { userId, isBlocked: true } } },
      include: {
        _count: { select: { members: { where: { isBlocked: false } } } },
        members: { where: { userId, isBlocked: false }, select: { id: true } },
        pins: { where: { userId }, select: { id: true } },
        reads: { where: { userId }, select: { lastReadAt: true, lastReadMessageId: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Unread counts for every joined group in a single query, rather than one
    // COUNT per group (which made this endpoint scale linearly with group
    // count). Restricted to groups the user has actually joined — a group
    // with no `ChatGroupRead` row has no "read up to" position to count
    // forward from, so including it here would report its *entire* message
    // history as unread for every student merely browsing the group list.
    //
    // A VALUES-list join (rather than a single WHERE with one OR branch per
    // group, each carrying a different `createdAt` threshold) lets Postgres
    // resolve each group as its own indexed range scan against
    // ChatMessage_groupId_createdAt_idx instead of one large scan it can't
    // cleanly plan against a composite index.
    const joinedGroups = groups.filter((g) => g.members.length > 0);
    const readAtByGroup = new Map<string, Date | undefined>(
      joinedGroups.map((g) => [g.id, g.reads[0]?.lastReadAt]),
    );
    const unreadByGroup = new Map<string, number>();
    if (joinedGroups.length) {
      const rows = await this.prisma.$queryRaw<{ groupId: string; count: number }[]>(
        Prisma.sql`
          SELECT v."groupId", COUNT(m.id)::int AS count
          FROM (VALUES ${Prisma.join(
            joinedGroups.map(
              (g) => Prisma.sql`(${g.id}::text, ${readAtByGroup.get(g.id) ?? null}::timestamp)`,
            ),
          )}) AS v("groupId", "lastReadAt")
          JOIN "ChatMessage" m
            ON m."groupId" = v."groupId"
            AND (v."lastReadAt" IS NULL OR m."createdAt" > v."lastReadAt")
          GROUP BY v."groupId"
        `,
      );
      for (const r of rows) unreadByGroup.set(r.groupId, Number(r.count));
    }

    return groups.map((g) => {
      const readRecord = g.reads[0];
      const { members, pins, reads, messages, ...groupFields } = g;
      const isJoined = members.length > 0;
      return {
        ...groupFields,
        memberCount: g._count.members,
        isJoined,
        isPinned: pins.length > 0,
        unreadCount: isJoined ? unreadByGroup.get(g.id) ?? 0 : 0,
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
    await this.assertNotBlocked(groupId, userId);
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

  async getGroupMessages(groupId: string, before?: string, limit = 50, userId?: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');
    // Stops a blocked student from reading the thread by opening the group URL
    // directly, now that the group no longer appears in their list.
    if (userId) await this.assertNotBlocked(groupId, userId);

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

    // Prevent poll author from voting on their own poll
    if (metadata?.poll && message.userId === userId) {
      throw new BadRequestException('As the author of this poll, you cannot vote on your own poll');
    }

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

    await this.assertNotBlocked(groupId, userId);
    const member = await this.isMember(groupId, userId);
    if (!member) {
      // The frontend treats ADMIN as an implicit member of every group (no "Join"
      // step shown), so the backend has to honor that assumption instead of
      // rejecting the send — otherwise an admin's post (including any uploaded
      // image) silently 400s after the upload already succeeded.
      if (userRole === UserRole.ADMIN) {
        await this.prisma.chatGroupMember.upsert({
          where: { groupId_userId: { groupId, userId } },
          create: { groupId, userId },
          update: {},
        });
      } else {
        throw new BadRequestException('You must join this group before sending messages');
      }
    }

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

  /**
   * Paginated + searchable roster. Groups can hold tens of thousands of members,
   * so this never returns the whole list — the admin searches by name or email
   * and pages through the matches.
   */
  async listGroupMembers(
    groupId: string,
    options: { search?: string; page?: number; limit?: number; status?: MemberStatusFilter } = {},
  ) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');

    const page = Math.max(1, Math.floor(options.page || 1));
    const limit = Math.min(MAX_MEMBER_PAGE_SIZE, Math.max(1, Math.floor(options.limit || DEFAULT_MEMBER_PAGE_SIZE)));
    const search = options.search?.trim();

    const where: Prisma.ChatGroupMemberWhereInput = {
      groupId,
      ...(options.status === 'BLOCKED' ? { isBlocked: true } : {}),
      ...(options.status === 'ACTIVE' ? { isBlocked: false } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
              ],
            },
          }
        : {}),
    };

    const [items, total, blockedCount] = await Promise.all([
      this.prisma.chatGroupMember.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
        orderBy: { joinedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chatGroupMember.count({ where }),
      this.prisma.chatGroupMember.count({ where: { groupId, isBlocked: true } }),
    ]);

    return {
      items,
      total,
      blockedCount,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async removeMember(groupId: string, userId: string) {
    await this.prisma.chatGroupMember.deleteMany({ where: { groupId, userId } });
    return { groupId, userId, removed: true };
  }

  /**
   * Blocks a member without deleting their row, so the admin can still find them
   * in the roster to undo it. Admins can't be blocked out of their own groups.
   */
  async setMemberBlocked(groupId: string, userId: string, blocked: boolean) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');

    const membership = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { user: { select: { role: true } } },
    });
    if (!membership) throw new NotFoundException('This user is not a member of the group');
    if (blocked && membership.user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admins cannot be blocked from a group');
    }

    return this.prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { isBlocked: blocked, blockedAt: blocked ? new Date() : null },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
    });
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
