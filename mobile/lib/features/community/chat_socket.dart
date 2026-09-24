import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/config/app_config.dart';
import '../../data/models/chat.dart';

/// Live connection to the API's Socket.IO chat gateway.
///
/// The gateway authenticates from `handshake.auth.token` / `headers.authorization`
/// and rejects anything unauthenticated, so a socket is only opened for a signed-in student.
class ChatSocket {
  ChatSocket({required this.accessToken});

  final String accessToken;

  io.Socket? _socket;
  String? _activeGroupId;

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
    if (_socket != null) {
      if (!_socket!.connected) {
        _socket!.connect();
      }
      return;
    }

    if (kDebugMode) {
      debugPrint('[ChatSocket] Connecting to gateway at ${AppConfig.socketUrl}');
    }

    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': accessToken})
          .setExtraHeaders({'Authorization': 'Bearer $accessToken'})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setReconnectionAttempts(99999)
          .build(),
    );

    socket.onConnect((_) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Connected to Socket.IO gateway (socket id: ${socket.id})');
      }
      _connected.add(true);
      if (_activeGroupId != null) {
        _joinRoomInternal(socket, _activeGroupId!);
      }
    });

    socket.onReconnect((_) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Reconnected to Socket.IO gateway');
      }
      _connected.add(true);
      if (_activeGroupId != null) {
        _joinRoomInternal(socket, _activeGroupId!);
      }
    });

    socket.onDisconnect((reason) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Disconnected: $reason');
      }
      _connected.add(false);
    });

    socket.onConnectError((error) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Connect error: $error');
      }
      _connected.add(false);
    });

    socket.onError((error) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Socket error: $error');
      }
    });

    socket.on('newChatMessage', (data) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Received newChatMessage: $data');
      }
      if (data is Map) {
        try {
          final msg = ChatMessage.fromJson(Map<String, dynamic>.from(data));
          _messages.add(msg);
        } catch (e) {
          if (kDebugMode) debugPrint('[ChatSocket] Error parsing newChatMessage: $e');
        }
      }
    });

    socket.on('messageMetadataUpdated', (data) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Received messageMetadataUpdated: $data');
      }
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
      if (kDebugMode) {
        debugPrint('[ChatSocket] Received messageEdited: $data');
      }
      if (data is Map && data['message'] is Map) {
        try {
          final msg = ChatMessage.fromJson(
            Map<String, dynamic>.from(data['message'] as Map),
          );
          _edits.add(msg);
        } catch (e) {
          if (kDebugMode) debugPrint('[ChatSocket] Error parsing messageEdited: $e');
        }
      }
    });

    socket.on('messageDeleted', (data) {
      if (kDebugMode) {
        debugPrint('[ChatSocket] Received messageDeleted: $data');
      }
      if (data is Map && data['messageId'] != null) {
        _deletions.add(data['messageId'].toString());
      }
    });

    _socket = socket;
  }

  void _joinRoomInternal(io.Socket socket, String groupId) {
    final room = 'group:$groupId';
    socket.emit('joinRoom', {'room': room});
    if (kDebugMode) {
      debugPrint('[ChatSocket] Emitted joinRoom $room');
    }
  }

  /// Subscribes to one group's live feed. Rooms are named `group:<id>` by the
  /// gateway; re-emitted on every reconnect so the subscription survives a
  /// dropped connection.
  void joinGroup(String groupId) {
    _activeGroupId = groupId;
    if (_socket != null && _socket!.connected) {
      _joinRoomInternal(_socket!, groupId);
    }
  }

  /// Leaves a group's live feed when navigating away from the chat screen.
  void leaveGroup(String groupId) {
    if (_activeGroupId == groupId) {
      _activeGroupId = null;
    }
    final room = 'group:$groupId';
    if (_socket != null && _socket!.connected) {
      _socket!.emit('leaveRoom', {'room': room});
      if (kDebugMode) {
        debugPrint('[ChatSocket] Emitted leaveRoom $room');
      }
    }
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
    _activeGroupId = null;
    _socket?.dispose();
    _socket = null;
    _messages.close();
    _metadataUpdates.close();
    _deletions.close();
    _edits.close();
    _connected.close();
  }
}
