import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/data/models/library.dart';

void main() {
  group('YouTube ID Extraction', () {
    test('extracts from standard watch URL', () {
      expect(
        extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
    });

    test('extracts from youtu.be short URL', () {
      expect(
        extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
    });

    test('extracts from embed URL', () {
      expect(
        extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
    });

    test('extracts from shorts URL', () {
      expect(
        extractYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
    });

    test('extracts from live URL', () {
      expect(
        extractYoutubeId('https://www.youtube.com/live/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
    });

    test('returns bare 11-char ID directly', () {
      expect(extractYoutubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    });

    test('returns empty string for invalid links', () {
      expect(extractYoutubeId('https://example.com/not-a-video'), '');
      expect(extractYoutubeId(''), '');
    });
  });

  group('VideoItem effectiveThumbnailUrl Resolution', () {
    test('uses existing valid http thumbnailUrl', () {
      final item = VideoItem(
        id: '1',
        chapterId: 'chap-1',
        title: 'DAY 1',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://custom-cdn.com/my-thumb.jpg',
        orderIndex: 0,
      );
      expect(item.effectiveThumbnailUrl, 'https://custom-cdn.com/my-thumb.jpg');
    });

    test('generates YouTube HQ thumbnail if thumbnailUrl is empty but youtubeVideoId is set', () {
      final item = VideoItem(
        id: '2',
        chapterId: 'chap-1',
        title: 'DAY 2',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        thumbnailUrl: '',
        orderIndex: 1,
      );
      expect(
        item.effectiveThumbnailUrl,
        'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      );
    });

    test('extracts ID from youtubeUrl when both thumbnailUrl and youtubeVideoId are missing in JSON', () {
      final json = {
        'id': '3',
        'chapterId': 'chap-1',
        'title': 'DAY 3',
        'youtubeUrl': 'https://youtu.be/abc12345678',
        'orderIndex': 2,
      };
      final item = VideoItem.fromJson(json);
      expect(item.youtubeVideoId, 'abc12345678');
      expect(
        item.effectiveThumbnailUrl,
        'https://img.youtube.com/vi/abc12345678/hqdefault.jpg',
      );
    });
  });
}
