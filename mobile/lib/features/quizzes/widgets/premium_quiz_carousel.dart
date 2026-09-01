import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/auth_controller.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../../../data/models/quiz.dart';
import '../quizzes_providers.dart';
import 'quiz_card.dart';

/// A polished, auto-scrolling horizontal rail that showcases the 10 most
/// recently added premium quizzes, matching the Home Page Book Cards.
class PremiumQuizCarousel extends ConsumerStatefulWidget {
  const PremiumQuizCarousel({
    super.key,
    this.quizzesAsync,
    this.onQuizTap,
  });

  final AsyncValue<List<Quiz>>? quizzesAsync;
  final ValueChanged<Quiz>? onQuizTap;

  @override
  ConsumerState<PremiumQuizCarousel> createState() =>
      _PremiumQuizCarouselState();
}

class _PremiumQuizCarouselState extends ConsumerState<PremiumQuizCarousel> {
  final ScrollController _scrollController = ScrollController();
  Timer? _autoScrollTimer;
  Timer? _resumeTimer;
  bool _isInteracting = false;

  @override
  void initState() {
    super.initState();
    _checkAndStartAutoScroll();
  }

  @override
  void didUpdateWidget(covariant PremiumQuizCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.quizzesAsync != oldWidget.quizzesAsync) {
      _checkAndStartAutoScroll();
    }
  }

  void _checkAndStartAutoScroll() {
    final AsyncValue<List<Quiz>> asyncData =
        widget.quizzesAsync ?? ref.read(premiumCarouselQuizzesProvider);
    asyncData.whenData((quizzes) {
      if (quizzes.length > 1) {
        _startAutoScroll();
      } else {
        _stopAutoScroll();
      }
    });
  }

  void _startAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = Timer.periodic(const Duration(milliseconds: 3200), (_) {
      if (!mounted || !_scrollController.hasClients || _isInteracting) return;

      final maxScroll = _scrollController.position.maxScrollExtent;
      final currentScroll = _scrollController.offset;
      const step = 240.0 + 14.0; // card width + separator

      if (currentScroll >= maxScroll - 8) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 1100),
          curve: Curves.easeInOutCubic,
        );
      } else {
        final next = (currentScroll + step).clamp(0.0, maxScroll);
        _scrollController.animateTo(
          next,
          duration: const Duration(milliseconds: 750),
          curve: Curves.easeInOutCubic,
        );
      }
    });
  }

  void _stopAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = null;
    _resumeTimer?.cancel();
    _resumeTimer = null;
  }

  void _onPointerDown() {
    _isInteracting = true;
    _autoScrollTimer?.cancel();
    _resumeTimer?.cancel();
  }

  void _onPointerUp() {
    _resumeTimer?.cancel();
    _resumeTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        _isInteracting = false;
        _startAutoScroll();
      }
    });
  }

  void _openQuiz(Quiz quiz) {
    if (widget.onQuizTap != null) {
      widget.onQuizTap!(quiz);
      return;
    }

    final signedIn = ref.read(authControllerProvider).isAuthenticated;
    final target = AppRoutes.quizAttempt(quiz.id);
    if (!signedIn) {
      context.push('${AppRoutes.login}?redirect=${Uri.encodeComponent(target)}');
      return;
    }
    context.push(target);
  }

  @override
  void dispose() {
    _stopAutoScroll();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<Quiz>> asyncData =
        widget.quizzesAsync ?? ref.watch(premiumCarouselQuizzesProvider);

    return SizedBox(
      height: 246,
      child: asyncData.when(
        skipLoadingOnRefresh: true,
        loading: () => ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: 3,
          separatorBuilder: (_, __) => const SizedBox(width: 14),
          itemBuilder: (_, __) => const SkeletonBox(
            width: 240,
            height: 240,
            radius: AppTheme.radiusLg,
          ),
        ),
        error: (error, _) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: ErrorView(error: error, compact: true),
        ),
        data: (quizzes) {
          if (quizzes.isEmpty) {
            return Center(
              child: Text(
                'No premium quizzes available.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: context.palette.textMuted,
                    ),
              ),
            );
          }

          if (_autoScrollTimer == null && quizzes.length > 1) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _startAutoScroll();
            });
          }

          return Listener(
            onPointerDown: (_) => _onPointerDown(),
            onPointerUp: (_) => _onPointerUp(),
            onPointerCancel: (_) => _onPointerUp(),
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification is ScrollStartNotification ||
                    notification is UserScrollNotification) {
                  _onPointerDown();
                } else if (notification is ScrollEndNotification) {
                  _onPointerUp();
                }
                return false;
              },
              child: ListView.separated(
                controller: _scrollController,
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                itemCount: quizzes.length,
                separatorBuilder: (_, __) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  final quiz = quizzes[index];
                  return QuizCard(
                    quiz: quiz,
                    width: 240,
                    onTap: () => _openQuiz(quiz),
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
