import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/quizzes_repository.dart';
import 'package:psc_tips_tricks_mobile/features/quizzes/quizzes_providers.dart';

/// One recorded call to `fetchQuizzes`, so a test can assert what the hub
/// actually asked the server for.
class _QuizQuery {
  const _QuizQuery({this.folderName, this.accessType, this.search, this.sort});

  final String? folderName;
  final String? accessType;
  final String? search;
  final String? sort;
}

class _FakeQuizzes extends QuizzesRepository {
  _FakeQuizzes() : super(ApiClient(tokenStore: TokenStore()));

  final List<_QuizQuery> quizCalls = [];
  int folderCalls = 0;

  static QuizFolder _folder(
    String id,
    String name, {
    String? parentId,
    int free = 0,
    int paid = 0,
  }) =>
      QuizFolder(
        id: id,
        name: name,
        parentId: parentId,
        orderIndex: 0,
        quizCount: free + paid,
        freeQuizCount: free,
        paidQuizCount: paid,
      );

  static Quiz _quiz(String id, String folder, {bool premium = false}) => Quiz(
        id: id,
        title: 'Quiz $id',
        folderName: folder,
        totalQuestions: 10,
        durationMinutes: 20,
        isLiveMock: false,
        isPremium: premium,
        price: premium ? 100 : 0,
        passingMarks: 4,
        totalMarks: 10,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: false,
      );

  @override
  Future<List<QuizFolder>> fetchFolders({String? parentId}) async {
    folderCalls += 1;
    return [
      _folder('f1', 'Kerala History', free: 3, paid: 0),
      _folder('f2', 'Current Affairs', free: 0, paid: 5),
      // Empty of its own quizzes but its child holds free ones, which is what
      // the server's roll-up already accounts for.
      _folder('f3', 'General Science', free: 2, paid: 0),
      _folder('f4', 'Physics', parentId: 'f3', free: 2, paid: 0),
    ];
  }

  @override
  Future<List<Quiz>> fetchQuizzes({
    String? search,
    String? folderName,
    String? accessType,
    bool publishedOnly = true,
    int page = 1,
    int limit = 30,
    String? sort,
  }) async {
    quizCalls.add(_QuizQuery(
      folderName: folderName,
      accessType: accessType,
      search: search,
      sort: sort,
    ));
    return [_quiz('q1', folderName ?? 'Root', premium: accessType == 'PAID')];
  }

  @override
  Future<int> fetchQuizCount({required String accessType}) async =>
      accessType == 'PAID' ? 5 : 5;
}

void main() {
  late _FakeQuizzes repo;

  ProviderContainer boot() {
    repo = _FakeQuizzes();
    final container = ProviderContainer(
      overrides: [quizzesRepositoryProvider.overrideWith((ref) => repo)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('folder counts come off the folder record', () {
    test('QuizFolder parses the per-tier roll-ups the API sends', () {
      final folder = QuizFolder.fromJson(const {
        'id': 'f1',
        'name': 'Kerala History',
        'orderIndex': 0,
        'quizCount': 4,
        'subFolderCount': 1,
        'freeQuizCount': 3,
        'paidQuizCount': 6,
      });

      expect(folder.freeQuizCount, 3);
      expect(folder.paidQuizCount, 6);
    });

    test('a missing count reads as zero rather than throwing', () {
      final folder = QuizFolder.fromJson(const {
        'id': 'f1',
        'name': 'Old Payload',
        'orderIndex': 0,
      });

      expect(folder.freeQuizCount, 0);
      expect(folder.paidQuizCount, 0);
    });

    test('the tier picks which roll-up is read', () {
      final folder = _FakeQuizzes._folder('f1', 'Mixed', free: 3, paid: 6);

      expect(folderQuizCountFor(folder, QuizAccessTier.free), 3);
      expect(folderQuizCountFor(folder, QuizAccessTier.premium), 6);
      // No tier chosen: the folder's whole contents.
      expect(folderQuizCountFor(folder, null), 9);
    });
  });

  group('the hub loads folders first and quizzes per folder', () {
    test('the landing level fetches no quizzes at all', () async {
      final container = boot();

      expect(await container.read(quizzesProvider.future), isEmpty);
      expect(await container.read(quizFoldersProvider.future), isEmpty);
      expect(repo.quizCalls, isEmpty);
    });

    test('choosing a tier lists its folders without loading any quiz', () async {
      final container = boot();
      container.read(quizAccessTierProvider.notifier).state =
          QuizAccessTier.free;

      final folders = await container.read(quizFoldersProvider.future);

      // Top-level folders holding free quizzes — "Current Affairs" is premium
      // only, and "Physics" is a child rather than a root.
      expect(folders.map((f) => f.name), ['Kerala History', 'General Science']);
      expect(repo.folderCalls, 1);
      // Folder counts came off the folder records: the catalog is untouched.
      expect(repo.quizCalls, isEmpty);
    });

    test('opening a folder asks for that folder and that tier only', () async {
      final container = boot();
      container.read(quizAccessTierProvider.notifier).state =
          QuizAccessTier.premium;
      // At the tier root, before any folder is opened.
      await container.read(quizzesProvider.future);
      expect(repo.quizCalls.single.folderName, 'Root');
      expect(repo.quizCalls.single.accessType, 'PAID');

      container.read(folderPathProvider.notifier).state = FolderPath(
        [_FakeQuizzes._folder('f2', 'Current Affairs', paid: 5)],
      );
      await container.read(quizzesProvider.future);

      expect(repo.quizCalls.last.folderName, 'Current Affairs');
      expect(repo.quizCalls.last.accessType, 'PAID');
      expect(repo.quizCalls.last.search, isNull);
      // One request per level — never the whole catalog.
      expect(repo.quizCalls.length, 2);
    });

    test('a search widens back out across the tier, not one folder', () async {
      final container = boot();
      container.read(quizAccessTierProvider.notifier).state =
          QuizAccessTier.free;
      container.read(folderPathProvider.notifier).state =
          FolderPath([_FakeQuizzes._folder('f1', 'Kerala History', free: 3)]);
      container.read(quizSearchProvider.notifier).state = 'history';

      await container.read(quizzesProvider.future);

      expect(repo.quizCalls.last.search, 'history');
      expect(repo.quizCalls.last.folderName, isNull);
      expect(repo.quizCalls.last.accessType, 'FREE');
      // Searching is a flat list, so the folder rail steps aside.
      expect(await container.read(quizFoldersProvider.future), isEmpty);
    });

    test('the premium carousel is sorted and trimmed by the server', () async {
      final container = boot();

      await container.read(premiumCarouselQuizzesProvider.future);

      expect(repo.quizCalls.single.accessType, 'PAID');
      expect(repo.quizCalls.single.sort, 'newest');
    });

    test('tier totals are counted by the server, not by loading quizzes',
        () async {
      final container = boot();

      final counts = await container.read(quizTierCountsProvider.future);

      expect(counts[QuizAccessTier.free], 5);
      expect(counts[QuizAccessTier.premium], 5);
      expect(repo.quizCalls, isEmpty);
    });
  });
}
