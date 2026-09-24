import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/chat.dart';
import '../../../data/repositories/chat_repository.dart';

class _PollOptionItem {
  _PollOptionItem({required this.id, required this.controller});
  final String id;
  final TextEditingController controller;
}

class PollDraftResult {
  const PollDraftResult({
    required this.question,
    required this.options,
    required this.correctOptionId,
    this.editingMessageId,
  });

  final String question;
  final List<String> options;
  final String correctOptionId;
  final String? editingMessageId;
}

/// Modal bottom sheet for creating or editing a study poll in a community chat group.
/// Matches the web platform's poll composer styling, interaction, and duplicate validation.
class PollComposerSheet extends ConsumerStatefulWidget {
  const PollComposerSheet({
    super.key,
    required this.groupId,
    this.editingPoll,
    this.onSubmitted,
  });

  final String groupId;
  final ChatMessage? editingPoll;
  final ValueChanged<PollDraftResult>? onSubmitted;

  static Future<PollDraftResult?> show(
    BuildContext context, {
    required String groupId,
    ChatMessage? editingPoll,
  }) {
    return showModalBottomSheet<PollDraftResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => PollComposerSheet(
        groupId: groupId,
        editingPoll: editingPoll,
      ),
    );
  }

  @override
  ConsumerState<PollComposerSheet> createState() => _PollComposerSheetState();
}

class _PollComposerSheetState extends ConsumerState<PollComposerSheet> {
  final _questionController = TextEditingController();
  final List<_PollOptionItem> _options = [];
  String? _correctOptionId;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final editing = widget.editingPoll;
    if (editing != null) {
      _questionController.text = editing.pollQuestion;
      final pollOpts = editing.pollOptions;
      if (pollOpts.isNotEmpty) {
        for (final opt in pollOpts) {
          _options.add(
            _PollOptionItem(
              id: opt.id,
              controller: TextEditingController(text: opt.text),
            ),
          );
        }
        _correctOptionId = editing.pollCorrectOptionId ?? _options.first.id;
      }
    }

    if (_options.isEmpty) {
      _options.addAll([
        _PollOptionItem(
          id: 'opt-1',
          controller: TextEditingController(),
        ),
        _PollOptionItem(
          id: 'opt-2',
          controller: TextEditingController(),
        ),
      ]);
      _correctOptionId = 'opt-1';
    }
  }

  @override
  void dispose() {
    _questionController.dispose();
    for (final opt in _options) {
      opt.controller.dispose();
    }
    super.dispose();
  }

  void _addOption() {
    if (_options.length >= 6) return;
    setState(() {
      _errorMessage = null;
      final nextId = 'opt-${DateTime.now().millisecondsSinceEpoch}-${_options.length + 1}';
      _options.add(
        _PollOptionItem(
          id: nextId,
          controller: TextEditingController(),
        ),
      );
    });
  }

  void _removeOption(int index) {
    if (_options.length <= 2) return;
    setState(() {
      _errorMessage = null;
      final removed = _options.removeAt(index);
      removed.controller.dispose();
      if (_correctOptionId == removed.id && _options.isNotEmpty) {
        _correctOptionId = _options.first.id;
      }
    });
  }

  Future<void> _submit() async {
    final question = _questionController.text.trim();
    final validOptions = _options.where((o) => o.controller.text.trim().isNotEmpty).toList();

    if (question.isEmpty || validOptions.length < 2) {
      setState(() {
        _errorMessage = 'Please provide a question and at least 2 options.';
      });
      return;
    }

    // Validate duplicate option values (case-insensitive & whitespace-trimmed)
    final trimmedTexts = validOptions.map((o) => o.controller.text.trim().toLowerCase()).toList();
    final hasDuplicates = trimmedTexts.toSet().length != trimmedTexts.length;
    if (hasDuplicates) {
      setState(() {
        _errorMessage = 'Duplicate poll options are not allowed. Each option must be unique.';
      });
      return;
    }

    final correctIdx = validOptions.indexWhere((o) => o.id == _correctOptionId);
    final resolvedCorrectId = correctIdx >= 0 ? 'opt-${correctIdx + 1}' : 'opt-1';

    final draft = PollDraftResult(
      question: question,
      options: validOptions.map((o) => o.controller.text.trim()).toList(),
      correctOptionId: resolvedCorrectId,
      editingMessageId: widget.editingPoll?.id,
    );

    widget.onSubmitted?.call(draft);

    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop(draft);
    } else {
      // Standalone fallback (e.g. testing without route navigator)
      try {
        final pollMetadata = {
          'poll': {
            'question': draft.question,
            'options': draft.options.asMap().entries.map((entry) {
              return {
                'id': 'opt-${entry.key + 1}',
                'text': entry.value,
                'votes': 0,
                'votedUserIds': <String>[],
              };
            }).toList(),
            'totalVotes': 0,
            'correctOptionId': draft.correctOptionId,
          },
        };
        await ref.read(chatRepositoryProvider).sendMessage(
          widget.groupId,
          content: draft.question,
          messageType: 'POLL',
          metadata: pollMetadata,
        );
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;
    final isEditing = widget.editingPoll != null;

    final mediaQuery = MediaQuery.of(context);
    final bottomInset = mediaQuery.viewInsets.bottom;

    return AnimatedPadding(
      padding: EdgeInsets.only(bottom: bottomInset),
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: mediaQuery.size.height * 0.88,
        ),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0A0F1D) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
            top: BorderSide(
              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
              width: 1,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.5 : 0.15),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 10),
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: palette.textMuted.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 10, 10, 10),
                child: Row(
                  children: [
                    const Icon(
                      Icons.bar_chart_rounded,
                      size: 20,
                      color: Color(0xFF06B6D4),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        isEditing ? 'EDIT STUDY POLL / QUESTION' : 'CREATE STUDY POLL / QUESTION',
                        style: const TextStyle(
                          color: Color(0xFF06B6D4),
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      color: palette.textMuted,
                      onPressed: () => Navigator.of(context).pop(),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
              ),
              Divider(
                height: 1,
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
              ),

              // Scrollable Content
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Error Message Banner
                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.rose.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: AppColors.rose.withValues(alpha: 0.35),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                size: 16,
                                color: AppColors.rose,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: const TextStyle(
                                    color: AppColors.rose,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Question Field
                      const Text(
                        'QUESTION',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _questionController,
                        minLines: 2,
                        maxLines: 4,
                        style: TextStyle(
                          color: palette.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                        onChanged: (_) {
                          if (_errorMessage != null) {
                            setState(() => _errorMessage = null);
                          }
                        },
                        decoration: InputDecoration(
                          hintText: 'Ask a question or enter quiz item...',
                          hintStyle: TextStyle(
                            color: palette.textMuted,
                            fontSize: 12.5,
                          ),
                          filled: true,
                          fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFF06B6D4),
                              width: 1.5,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Options Header
                      const Row(
                        children: [
                          Text(
                            'POLL OPTIONS',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Mark the correct answer',
                              textAlign: TextAlign.end,
                              style: TextStyle(
                                color: Color(0xFF06B6D4),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Option Rows
                      for (var i = 0; i < _options.length; i++) ...[
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            children: [
                              // Mark Correct Button
                              InkWell(
                                onTap: () {
                                  setState(() {
                                    _correctOptionId = _options[i].id;
                                  });
                                },
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: _correctOptionId == _options[i].id
                                        ? const Color(0xFF10B981)
                                        : (isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9)),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: _correctOptionId == _options[i].id
                                          ? const Color(0xFF10B981)
                                          : (isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1)),
                                    ),
                                  ),
                                  child: Icon(
                                    _correctOptionId == _options[i].id
                                        ? Icons.check_circle_rounded
                                        : Icons.check_circle_outline_rounded,
                                    size: 18,
                                    color: _correctOptionId == _options[i].id
                                        ? Colors.white
                                        : palette.textMuted,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),

                              // Option Input
                              Expanded(
                                child: SizedBox(
                                  height: 38,
                                  child: TextField(
                                    controller: _options[i].controller,
                                    textAlignVertical: TextAlignVertical.center,
                                    style: TextStyle(
                                      color: palette.textPrimary,
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    onChanged: (_) {
                                      if (_errorMessage != null) {
                                        setState(() => _errorMessage = null);
                                      }
                                    },
                                    decoration: InputDecoration(
                                      hintText: 'Option ${i + 1}...',
                                      hintStyle: TextStyle(
                                        color: palette.textMuted,
                                        fontSize: 12,
                                      ),
                                      filled: true,
                                      fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                                      contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 10,
                                      ),
                                      isDense: true,
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(10),
                                        borderSide: BorderSide(
                                          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
                                        ),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(10),
                                        borderSide: BorderSide(
                                          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
                                        ),
                                      ),
                                      focusedBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(10),
                                        borderSide: const BorderSide(
                                          color: Color(0xFF06B6D4),
                                          width: 1.5,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),

                              // Remove Button (if > 2 options)
                              if (_options.length > 2) ...[
                                const SizedBox(width: 4),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, size: 18),
                                  color: palette.textMuted,
                                  hoverColor: AppColors.rose.withValues(alpha: 0.1),
                                  onPressed: () => _removeOption(i),
                                  visualDensity: VisualDensity.compact,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],

                      // Add Option Button
                      if (_options.length < 6) ...[
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: _addOption,
                            style: TextButton.styleFrom(
                              foregroundColor: const Color(0xFF06B6D4),
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                              visualDensity: VisualDensity.compact,
                            ),
                            icon: const Icon(Icons.add_rounded, size: 16),
                            label: const Text(
                              'Add Option',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Footer Actions
              Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF080D1A) : const Color(0xFFF8FAFC),
                  border: Border(
                    top: BorderSide(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                      width: 1,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        side: BorderSide(
                          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          color: palette.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF06B6D4), Color(0xFF2563EB)],
                        ),
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF06B6D4).withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text(
                          isEditing ? 'Save Changes' : 'Create & Send Poll',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
