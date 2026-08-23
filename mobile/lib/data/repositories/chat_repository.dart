import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/chat.dart';

class ChatRepository {
  ChatRepository(this._api);

  final ApiClient _api;

  Future<List<ChatGroup>> fetchGroups() async {
    final res = await _api.get<dynamic>('/chat/groups/mine');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => ChatGroup.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// One page of history, newest last. `before` pages backwards from a message
  /// id for infinite scroll.
  Future<List<ChatMessage>> fetchMessages(
    String groupId, {
    String? before,
    int limit = 40,
  }) async {
    final res = await _api.get<dynamic>(
      '/chat/groups/$groupId/messages',
      query: {'limit': limit, if (before != null) 'before': before},
    );
    return J.rows(res)
        .whereType<Map>()
        .map((e) => ChatMessage.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<ChatMessage> sendMessage(
    String groupId, {
    required String content,
    String messageType = 'TEXT',
    String? mediaUrl,
    Map<String, dynamic>? metadata,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/chat/groups/$groupId/messages',
      body: {
        'content': content,
        'messageType': messageType,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
        if (metadata != null) 'metadata': metadata,
      },
    );
    return ChatMessage.fromJson(res);
  }

  Future<void> join(String groupId) =>
      _api.post<dynamic>('/chat/groups/$groupId/join');

  Future<void> leave(String groupId) =>
      _api.post<dynamic>('/chat/groups/$groupId/leave');

  Future<void> setPinned(String groupId, bool pinned) => pinned
      ? _api.post<dynamic>('/chat/groups/$groupId/pin')
      : _api.delete<dynamic>('/chat/groups/$groupId/pin');

  Future<void> markRead(String groupId, {String? lastReadMessageId}) =>
      _api.post<dynamic>(
        '/chat/groups/$groupId/read',
        body: {
          if (lastReadMessageId != null) 'lastReadMessageId': lastReadMessageId,
        },
      );

  /// Uploads an image or document and returns the hosted URL to attach.
  Future<String> uploadAttachment(String filePath) async {
    final res = await _api.upload<Map<String, dynamic>>(
      '/chat/upload-attachment',
      filePath: filePath,
    );
    return J.str(res['url'] ?? res['mediaUrl']);
  }

  /// Records a vote by rewriting the poll's metadata, the same way the web
  /// client does — the API exposes no dedicated vote endpoint.
  Future<ChatMessage> votePoll({
    required String messageId,
    required Map<String, dynamic> metadata,
  }) async {
    final res = await _api.patch<Map<String, dynamic>>(
      '/chat/messages/$messageId/metadata',
      body: {'metadata': metadata},
    );
    return ChatMessage.fromJson(res);
  }
}
