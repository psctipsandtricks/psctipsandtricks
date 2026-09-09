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

/** History is always paged — a client never receives a whole group's backlog. */
const DEFAULT_MESSAGE_PAGE_SIZE = 30;
const MAX_MESSAGE_PAGE_SIZE = 100;

/**
 * Unread badges render as "99+" past this, so counting further is wasted work —
 * a student returning to a busy group would otherwise make the API count every
 * message posted since they last read.
 */
const MAX_UNREAD_COUNT = 100;

/** How much of a message body the sidebar preview needs. */
const LAST_MESSAGE_PREVIEW_CHARS = 280;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MemberStatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

/** The slice of a message the group list shows as its preview line. */
export interface LastMessagePreview {
  groupId: string;
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  messageType: string;
  mediaUrl: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

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

  /**
   * Removes a message. Its author may always take back their own; a moderator
   * may remove anyone's.
   *
   * [actor] is optional only for the legacy admin route, which has already
   * proved moderator rights through its guards. Every other caller passes one,
   * and passing none means "trusted caller" rather than "no check" — which is
   * why it is spelled out here rather than left to the reader.
   */
  async deleteMessage(id: string, actor?: { id: string; role: UserRole }) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');

    if (actor) {
      const isAuthor = message.userId === actor.id;
      if (!isAuthor && !(await this.canModerate(actor.id, actor.role))) {
        throw new ForbiddenException('You can only delete your own messages');
      }
    }
    return this.prisma.chatMessage.delete({ where: { id } });
  }

  /**
   * Rewrites a message's own content — its text, or a poll's question and
   * options. Only the author, and only their own.
   *
   * Deliberately not open to moderators: a moderator putting words in a
   * student's mouth under that student's name is a different and worse power
   * than removing the message, which they already have.
   *
   * Editing a poll leaves the votes alone. Options are matched by id, so
   * correcting a typo in an option keeps the votes cast for it; an option that
   * is removed takes its votes with it, and a new one starts at zero.
   */
  async editMessage(
    id: string,
    actor: { id: string },
    dto: { content?: string; metadata?: Record<string, any> },
  ) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.userId !== actor.id) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (message.groupId) {
      const group = await this.prisma.chatGroup.findUnique({
        where: { id: message.groupId },
        select: { isLocked: true },
      });
      if (group?.isLocked) {
        throw new BadRequestException('This group is locked by an admin');
      }
      await this.assertNotBlocked(message.groupId, actor.id);
    }

    const existing = (message.metadata as Record<string, any> | null) ?? {};
    let metadata = existing;

    if (dto.metadata?.poll) {
      const currentPoll = (existing.poll as Record<string, any> | undefined) ?? {};
      const currentOptions: any[] = Array.isArray(currentPoll.options)
        ? currentPoll.options
        : [];
      const votesById = new Map<string, { votes: number; votedUserIds: string[] }>(
        currentOptions.map((o: any) => [
          String(o?.id),
          {
            votes: Number(o?.votes) || 0,
            votedUserIds: Array.isArray(o?.votedUserIds) ? o.votedUserIds : [],
          },
        ]),
      );

      const nextOptions = (dto.metadata.poll.options as any[] | undefined) ?? [];
      const merged = nextOptions.map((o: any) => {
        const kept = votesById.get(String(o?.id));
        return {
          ...o,
          votes: kept?.votes ?? 0,
          votedUserIds: kept?.votedUserIds ?? [],
        };
      });

      metadata = {
        ...existing,
        poll: {
          ...currentPoll,
          ...dto.metadata.poll,
          options: merged,
          totalVotes: merged.reduce(
            (sum, o: any) => sum + (o.votedUserIds?.length || o.votes || 0),
            0,
          ),
        },
      };
    } else if (dto.metadata) {
      metadata = { ...existing, ...dto.metadata };
    }

    return this.prisma.chatMessage.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(metadata !== existing ? { metadata } : {}),
        editedAt: new Date(),
      },
    });
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
    const updated = await this.prisma.chatGroup.update({
      where: { id },
      data: { imageUrl: url },
    });
    // Only now that the replacement is stored and the record points at it.
    await this.storageService.removeReplacedFile(group.imageUrl, url, id);
    return updated;
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

  /**
   * Who a group notification should reach — active, unmuted members.
   *
   * Muting is honoured here, at the point of sending, rather than by hiding a
   * notification the client was told about: a muted group should cost a student
   * nothing, not arrive and be swallowed.
   */
  async getActiveMemberUserIds(groupId: string): Promise<string[]> {
    const members = await this.prisma.chatGroupMember.findMany({
      where: { groupId, isBlocked: false, isMuted: false },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  /** Silences or restores this group's notifications for one member. */
  async setMuted(groupId: string, userId: string, muted: boolean) {
    const membership = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) {
      throw new BadRequestException('Join this group before muting it');
    }
    await this.prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { isMuted: muted },
    });
    return { groupId, isMuted: muted };
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
        members: {
          where: { userId, isBlocked: false },
          select: { id: true, isMuted: true },
        },
        pins: { where: { userId }, select: { id: true } },
        reads: { where: { userId }, select: { lastReadAt: true, lastReadMessageId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Restricted to groups the user has actually joined — a group with no
    // `ChatGroupRead` row has no "read up to" position to count forward from,
    // so including it here would report its *entire* message history as unread
    // for every student merely browsing the group list.
    const joinedGroups = groups.filter((g) => g.members.length > 0);

    // Both of these used to be relation `include`s, which Prisma resolves with
    // a window function partitioned over every message in every listed group —
    // the single biggest cost in opening the Community page. Run as explicit
    // per-group index seeks instead, and in parallel with each other.
    const [lastMessageByGroup, unreadByGroup] = await Promise.all([
      this.fetchLastMessages(groups.map((g) => g.id)),
      this.countUnread(
        joinedGroups.map((g) => ({ groupId: g.id, lastReadAt: g.reads[0]?.lastReadAt })),
      ),
    ]);

    return groups.map((g) => {
      const readRecord = g.reads[0];
      const { members, pins, reads, ...groupFields } = g;
      const isJoined = members.length > 0;
      return {
        ...groupFields,
        memberCount: g._count.members,
        isJoined,
        isMuted: members[0]?.isMuted ?? false,
        /// Whether Join has to show the agreement first. The text itself is on
        /// `agreement`; this saves every client re-deriving "is it blank".
        requiresAgreement: !!g.agreement?.trim(),
        isPinned: pins.length > 0,
        unreadCount: isJoined ? unreadByGroup.get(g.id) ?? 0 : 0,
        lastReadMessageId: readRecord?.lastReadMessageId || null,
        lastMessage: lastMessageByGroup.get(g.id) ?? null,
      };
    });
  }

  /**
   * The newest message in each group, as one indexed seek per group via a
   * LATERAL join, rather than a scan over the groups' combined history.
   *
   * The preview is deliberately not the whole message row: bodies are trimmed
   * to what a one-line preview can show, and only a poll's question survives
   * from `metadata` — a poll that has collected thousands of votes carries a
   * `votedUserIds` array per option, and shipping those down for every group
   * dwarfed the rest of this response.
   */
  private async fetchLastMessages(groupIds: string[]): Promise<Map<string, LastMessagePreview>> {
    if (!groupIds.length) return new Map();

    const rows = await this.prisma.$queryRaw<LastMessagePreview[]>(
      Prisma.sql`
        SELECT m.*
        FROM (VALUES ${Prisma.join(groupIds.map((id) => Prisma.sql`(${id}::text)`))})
          AS g("groupId")
        CROSS JOIN LATERAL (
          SELECT
            c."groupId",
            c."id",
            c."userId",
            c."userName",
            c."userAvatar",
            LEFT(c."content", ${LAST_MESSAGE_PREVIEW_CHARS}::int) AS "content",
            c."messageType"::text AS "messageType",
            c."mediaUrl",
            CASE
              WHEN c."metadata" -> 'poll' ->> 'question' IS NOT NULL
                THEN jsonb_build_object(
                  'poll',
                  jsonb_build_object('question', c."metadata" -> 'poll' ->> 'question')
                )
              ELSE NULL
            END AS "metadata",
            c."createdAt"
          FROM "ChatMessage" c
          WHERE c."groupId" = g."groupId"
          ORDER BY c."createdAt" DESC
          LIMIT 1
        ) m
      `,
    );

    return new Map(rows.map((r) => [r.groupId, r]));
  }

  /**
   * Unread counts for every joined group in a single query, rather than one
   * COUNT per group (which made this endpoint scale linearly with group count).
   *
   * A VALUES-list join (rather than a single WHERE with one OR branch per
   * group, each carrying a different `createdAt` threshold) lets Postgres
   * resolve each group as its own indexed range scan against
   * ChatMessage_groupId_createdAt_idx instead of one large scan it can't
   * cleanly plan against a composite index. The inner LIMIT stops each of those
   * scans once the badge is already going to read "99+".
   */
  private async countUnread(
    groups: { groupId: string; lastReadAt?: Date }[],
  ): Promise<Map<string, number>> {
    if (!groups.length) return new Map();

    const rows = await this.prisma.$queryRaw<{ groupId: string; count: number }[]>(
      Prisma.sql`
        SELECT v."groupId", capped.count::int AS count
        FROM (VALUES ${Prisma.join(
          groups.map(
            (g) => Prisma.sql`(${g.groupId}::text, ${g.lastReadAt ?? null}::timestamp)`,
          ),
        )}) AS v("groupId", "lastReadAt")
        CROSS JOIN LATERAL (
          SELECT COUNT(*) AS count
          FROM (
            SELECT 1
            FROM "ChatMessage" m
            WHERE m."groupId" = v."groupId"
              AND (v."lastReadAt" IS NULL OR m."createdAt" > v."lastReadAt")
            LIMIT ${MAX_UNREAD_COUNT}::int
          ) AS bounded
        ) AS capped
      `,
    );

    return new Map(rows.map((r) => [r.groupId, Number(r.count)]));
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

  /**
   * Adds a student to a group, after they have accepted its agreement.
   *
   * The check is here rather than only in the clients because "you agreed to
   * this" has to mean something: a join that never went through the dialog is
   * refused outright, and the moment of acceptance is written down.
   *
   * A group with no agreement joins immediately, which is how every group
   * behaved before this existed.
   */
  async joinGroup(groupId: string, userId: string, acceptedAgreement = false) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Chat group not found');
    await this.assertNotBlocked(groupId, userId);

    const requiresAgreement = !!group.agreement?.trim();
    if (requiresAgreement && !acceptedAgreement) {
      throw new BadRequestException(
        'Accept the group agreement before joining this group',
      );
    }

    const acceptedAt = requiresAgreement ? new Date() : null;
    return this.prisma.chatGroupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId, agreementAcceptedAt: acceptedAt },
      // Rejoining re-accepts: the agreement may have been rewritten since, so
      // the stored date has to be when they last agreed, not the first time.
      update: requiresAgreement ? { agreementAcceptedAt: acceptedAt } : {},
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

  /**
   * One page of history, newest last. `before` pages backwards from the oldest
   * message a client already holds — it accepts either that message's id or its
   * `createdAt` timestamp, because the web and mobile clients page with
   * different cursors.
   */
  async getGroupMessages(
    groupId: string,
    before?: string,
    limit = DEFAULT_MESSAGE_PAGE_SIZE,
    userId?: string,
  ) {
    const take = Math.min(
      MAX_MESSAGE_PAGE_SIZE,
      Math.max(1, Math.floor(limit || DEFAULT_MESSAGE_PAGE_SIZE)),
    );

    // The group lookup and the block check don't depend on each other, so pay
    // for one round trip rather than two before any message is even read.
    const [group, membership] = await Promise.all([
      this.prisma.chatGroup.findUnique({ where: { id: groupId }, select: { id: true } }),
      userId
        ? this.prisma.chatGroupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
            select: { isBlocked: true },
          })
        : Promise.resolve(null),
    ]);
    if (!group) throw new NotFoundException('Chat group not found');
    // Stops a blocked student from reading the thread by opening the group URL
    // directly, now that the group no longer appears in their list.
    if (membership?.isBlocked) {
      throw new ForbiddenException('You have been blocked from this group by an admin');
    }

    const cursor = await this.resolveMessageCursor(before);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        groupId,
        ...(cursor ? { createdAt: { lt: cursor } } : {}),
      },
      include: { user: { select: { role: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return messages.reverse().map((m) => {
      const { user, ...rest } = m;
      return { ...rest, senderRole: user.role };
    });
  }

  /**
   * Turns a `before` cursor into the timestamp to page back from. A message id
   * costs one extra lookup; a timestamp is used as-is. An unparseable cursor is
   * rejected rather than silently ignored — quietly returning the newest page
   * instead would make "load older" loop over the same messages forever.
   */
  private async resolveMessageCursor(before?: string): Promise<Date | undefined> {
    const cursor = before?.trim();
    if (!cursor) return undefined;

    if (UUID_RE.test(cursor)) {
      const message = await this.prisma.chatMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (!message) throw new NotFoundException('Cursor message not found');
      return message.createdAt;
    }

    const parsed = new Date(cursor);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('`before` must be a message id or an ISO timestamp');
    }
    return parsed;
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
