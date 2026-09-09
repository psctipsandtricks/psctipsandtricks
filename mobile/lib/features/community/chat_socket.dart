import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/config/app_config.dart';
import '../../data/models/chat.dart';

/// Live connection to the API's Socket.IO chat gateway.
///
/// The gateway authenticates from `handshake.auth.token` and rejects anything
/// unauthenticated, so a socket is only ever opened for a signed-in student.
class ChatSocket {
  ChatSocket({required this.accessToken});

  final String accessToken;

  io.Socket? _socket;

  final _messages = StreamController<ChatMessage>.broadcast();
  final _metadataUpdates =
      StreamController<({String messageId, Map<String, dynamic> metadata})>
          .broadcast();
  final _deletions = StreamController<String>.broadcast();

  /// Messages an author rewrote — the whole message, so the thread can swap it
  /// in rather than guessing what changed.
  final _edits = StreamController<ChatMessage>.broadcast();
  final _connected = StreamController<bool>.broadcast();

  Stream<ChatMessage> get onMessage => _messages.stream;
  Stream<({String messageId, Map<String, dynamic> metadata})>
      get onMetadataUpdate => _metadataUpdates.stream;
  Stream<String> get onDelete => _deletions.stream;
  Stream<ChatMessage> get onEdit => _edits.stream;
  Stream<bool> get onConnectionChange => _connected.stream;

  bool get isConnected => _socket?.connected ?? false;

  void connect() {
    if (_socket != null) return;

    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': accessToken})
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );

    socket.onConnect((_) => _connected.add(true));
    socket.onDisconnect((_) => _connected.add(false));
    socket.onConnectError((error) {
      if (kDebugMode) debugPrint('Chat socket connect error: $error');
      _connected.add(false);
    });

    socket.on('newChatMessage', (data) {
      if (data is Map) {
        _messages.add(ChatMessage.fromJson(Map<String, dynamic>.from(data)));
      }
    });

    socket.on('messageMetadataUpdated', (data) {
      if (data is! Map) return;
      final messageId = data['messageId']?.toString();
      final metadata = data['metadata'];
      if (messageId != null && metadata is Map) {
        _metadataUpdates.add((
          messageId: messageId,
          metadata: Map<String, dynamic>.from(metadata),
        ));
      }
    });

    socket.on('messageEdited', (data) {
      if (data is Map && data['message'] is Map) {
        _edits.add(ChatMessage.fromJson(
          Map<String, dynamic>.from(data['message'] as Map),
        ));
      }
    });

    socket.on('messageDeleted', (data) {
      if (data is Map && data['messageId'] != null) {
        _deletions.add(data['messageId'].toString());
      }
    });

    _socket = socket;
  }

  /// Subscribes to one group's live feed. Rooms are named `group:<id>` by the
  /// gateway; re-emitted on every reconnect so the subscription survives a
  /// dropped connection.
  void joinGroup(String groupId) {
    final room = 'group:$groupId';
    _socket?.emit('joinRoom', {'room': room});
    _socket?.onConnect((_) {
      _connected.add(true);
      _socket?.emit('joinRoom', {'room': room});
    });
  }

  /// Sends over the socket so every member sees it immediately. The gateway
  /// persists it, so no parallel REST call is needed.
  void sendMessage({required String groupId, required String content}) {
    _socket?.emit('sendChatMessage', {
      'content': content,
      'groupId': groupId,
      'room': 'group:$groupId',
      'messageType': 'TEXT',
    });
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
    _messages.close();
    _metadataUpdates.close();
    _deletions.close();
    _edits.close();
    _connected.close();
  }
}
