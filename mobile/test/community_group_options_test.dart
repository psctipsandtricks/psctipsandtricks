import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/data/models/chat.dart';

void main() {
  group('a group that gates joining', () {
    ChatGroup parse(Map<String, dynamic> json) => ChatGroup.fromJson({
          'id': 'g1',
          'name': 'Kerala PSC LDC',
          'description': '',
          'category': 'General',
          'memberCount': 12,
          'isJoined': false,
          'isPinned': false,
          'unreadCount': 0,
          ...json,
        });

    test('an agreement makes Join show it first', () {
      final g = parse({'agreement': 'Be respectful. No spam.'});

      expect(g.requiresAgreement, isTrue);
      expect(g.agreement, 'Be respectful. No spam.');
    });

    test('no agreement means Join is immediate', () {
      // How every group behaved before this existed, and how one behaves
      // unless an admin writes something.
      expect(parse({}).requiresAgreement, isFalse);
      expect(parse({'agreement': null}).requiresAgreement, isFalse);
    });

    test('whitespace is not an agreement', () {
      // An admin who clears the box leaves an empty string behind; that must
      // not put a blank prompt in front of every student who joins.
      expect(parse({'agreement': '   \n  '}).requiresAgreement, isFalse);
    });
  });

  group('muting', () {
    test('the flag comes off the wire and survives the cache', () {
      final muted = ChatGroup.fromJson({
        'id': 'g1',
        'name': 'Kerala PSC LDC',
        'description': '',
        'category': 'General',
        'memberCount': 3,
        'isJoined': true,
        'isPinned': false,
        'unreadCount': 0,
        'isMuted': true,
        'agreement': 'Rules',
      });

      expect(muted.isMuted, isTrue);

      // Round-tripped through the offline cache, which stores what the API
      // sent — a muted group must not come back unmuted after a restart.
      final restored = ChatGroup.fromJson(muted.toJson());
      expect(restored.isMuted, isTrue);
      expect(restored.requiresAgreement, isTrue);
    });

    test('an older API build reads as unmuted rather than crashing', () {
      final g = ChatGroup.fromJson({
        'id': 'g1',
        'name': 'X',
        'description': '',
        'category': 'General',
        'memberCount': 0,
        'isJoined': true,
        'isPinned': false,
        'unreadCount': 0,
      });

      expect(g.isMuted, isFalse);
    });
  });

  group('an edited message', () {
    ChatMessage parse(Map<String, dynamic> extra) => ChatMessage.fromJson({
          'id': 'm1',
          'userId': 'u1',
          'userName': 'Aspirant',
          'content': 'fixed',
          'createdAt': '2026-09-09T04:00:00.000Z',
          ...extra,
        });

    test('carries when it was edited', () {
      final m = parse({'editedAt': '2026-09-09T05:30:00.000Z'});

      expect(m.editedAt, isNotNull);
      // Localised like every other timestamp, so it compares with createdAt.
      expect(m.editedAt!.isAfter(m.createdAt), isTrue);
    });

    test('an untouched message has no edit stamp', () {
      expect(parse({}).editedAt, isNull);
    });

    test('the stamp survives the offline cache', () {
      final edited = parse({'editedAt': '2026-09-09T05:30:00.000Z'});
      final restored = ChatMessage.fromJson(edited.toJson());

      expect(restored.editedAt, isNotNull);
      expect(restored.editedAt!.isAtSameMomentAs(edited.editedAt!), isTrue);
    });
  });
}
