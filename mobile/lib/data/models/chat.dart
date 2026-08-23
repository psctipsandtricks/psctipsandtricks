import '../../core/utils/json.dart';

enum ChatMessageType { text, poll, image, document }

ChatMessageType chatTypeFrom(dynamic v) {
  switch (J.str(v).toUpperCase()) {
    case 'POLL':
      return ChatMessageType.poll;
    case 'IMAGE':
      return ChatMessageType.image;
    case 'DOCUMENT':
      return ChatMessageType.document;
    default:
      return ChatMessageType.text;
  }
}

class ChatGroup {
  const ChatGroup({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.iconEmoji,
    required this.isLocked,
    required this.allowTextMessages,
    required this.allowPolls,
    required this.memberCount,
    required this.isJoined,
    required this.isPinned,
    required this.unreadCount,
    this.imageUrl,
    this.lastMessage,
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final String iconEmoji;
  final String? imageUrl;
  final bool isLocked;

  /// Admin switches — when false, the composer must not offer that message kind.
  final bool allowTextMessages;
  final bool allowPolls;

  final int memberCount;
  final bool isJoined;
  final bool isPinned;
  final int unreadCount;
  final ChatMessage? lastMessage;

  /// Students can only type when they have joined an unlocked group that still
  /// permits text.
  bool get canSendText => isJoined && !isLocked && allowTextMessages;

  factory ChatGroup.fromJson(Map<String, dynamic> json) => ChatGroup(
        id: J.str(json['id']),
        name: J.str(json['name']),
        description: J.str(json['description']),
        category: J.str(json['category']),
        iconEmoji: J.str(json['iconEmoji'], '💬'),
        imageUrl: J.strOrNull(json['imageUrl']),
        isLocked: J.boolVal(json['isLocked']),
        allowTextMessages: J.boolVal(json['allowTextMessages'], true),
        allowPolls: J.boolVal(json['allowPolls'], true),
        memberCount: J.intVal(json['memberCount']),
        isJoined: J.boolVal(json['isJoined']),
        isPinned: J.boolVal(json['isPinned']),
        unreadCount: J.intVal(json['unreadCount']),
        lastMessage: json['lastMessage'] is Map
            ? ChatMessage.fromJson(J.map(json['lastMessage']))
            : null,
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.userId,
    required this.userName,
    required this.content,
    required this.type,
    required this.createdAt,
    this.userAvatar,
    this.mediaUrl,
    this.metadata,
    this.groupId,
  });

  final String id;
  final String userId;
  final String userName;
  final String? userAvatar;
  final String content;
  final ChatMessageType type;
  final String? mediaUrl;
  final Map<String, dynamic>? metadata;
  final String? groupId;
  final DateTime createdAt;

  /// Poll payloads live in `metadata['poll']` or `metadata` as `{ question, options: [{ id, text, votes, votedUserIds }], correctOptionId, totalVotes }`.
  Map<String, dynamic>? get pollData =>
      metadata?['poll'] is Map ? Map<String, dynamic>.from(metadata!['poll'] as Map) : null;

  List<PollOption> get pollOptions {
    final raw = pollData?['options'] ?? metadata?['options'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => PollOption.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  String get pollQuestion =>
      J.str(pollData?['question'], J.str(metadata?['question'], content));

  int get pollTotalVotes {
    if (pollData?['totalVotes'] != null) {
      return J.intVal(pollData!['totalVotes']);
    }
    return pollOptions.fold<int>(0, (sum, o) => sum + o.voteCount);
  }

  String? get pollCorrectOptionId =>
      J.strOrNull(pollData?['correctOptionId'] ?? metadata?['correctOptionId']);

  bool get isPoll =>
      type == ChatMessageType.poll ||
      pollData != null ||
      (metadata?['poll'] != null) ||
      (metadata?['options'] is List) ||
      pollOptions.isNotEmpty;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final meta = J.mapOrNull(json['metadata']);
    final rawType = chatTypeFrom(json['messageType'] ?? json['type']);
    final effectiveType =
        (meta?['poll'] != null || meta?['options'] is List)
            ? ChatMessageType.poll
            : rawType;

    return ChatMessage(
      id: J.str(json['id']),
      userId: J.str(json['userId']),
      userName: J.str(json['userName'], 'Aspirant'),
      userAvatar: J.strOrNull(json['userAvatar']),
      content: J.str(json['content']),
      type: effectiveType,
      mediaUrl: J.strOrNull(json['mediaUrl']),
      metadata: meta,
      groupId: J.strOrNull(json['groupId']),
      createdAt: J.dateOrNull(json['createdAt']) ?? DateTime.now(),
    );
  }
}

class PollOption {
  const PollOption({
    required this.id,
    required this.text,
    required this.votes,
    required this.votedUserIds,
  });

  final String id;
  final String text;
  final int votes;
  final List<String> votedUserIds;

  int get voteCount => votedUserIds.isNotEmpty ? votedUserIds.length : votes;
  bool votedBy(String userId) => votedUserIds.contains(userId);

  factory PollOption.fromJson(Map<String, dynamic> json) {
    final voted = (json['votedUserIds'] as List?)
            ?.map((e) => e.toString())
            .toList() ??
        ((json['votes'] is List)
            ? (json['votes'] as List).map((e) => e.toString()).toList()
            : const <String>[]);
    final voteCount = json['votes'] is num
        ? (json['votes'] as num).toInt()
        : voted.length;

    return PollOption(
      id: J.str(json['id'], J.str(json['text'])),
      text: J.str(json['text']),
      votes: voteCount,
      votedUserIds: voted,
    );
  }
}
