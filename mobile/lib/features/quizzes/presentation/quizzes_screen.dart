import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class QuizzesScreen extends StatelessWidget {
  const QuizzesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quiz Hub & Mock Tests'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildQuizItem(
            'Kerala PSC LDC Mega Mock 2026',
            '100 Questions • 75 Mins',
            'Live Rank List Enabled',
            isLive: true,
          ),
          _buildQuizItem(
            'Indian Constitution & Fundamental Rights',
            '25 Questions • 20 Mins',
            'Polity Practice',
            isLive: false,
          ),
          _buildQuizItem(
            'Kerala Geography & Rivers Speed Test',
            '30 Questions • 15 Mins',
            'Kerala GK Special',
            isLive: false,
          ),
        ],
      ),
    );
  }

  Widget _buildQuizItem(String title, String details, String category,
      {required bool isLive}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        title: Text(title,
            style: const TextStyle(
                fontWeight: FontWeight.bold, color: Colors.white)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(details,
                style:
                    const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isLive
                    ? AppTheme.mutedGold.withValues(alpha: 0.2)
                    : Colors.white10,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                category,
                style: TextStyle(
                  color: isLive ? AppTheme.mutedGold : Colors.white70,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        trailing: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: isLive ? AppTheme.mutedGold : Colors.indigoAccent,
            foregroundColor: isLive ? AppTheme.deepNavy : Colors.white,
          ),
          onPressed: () {},
          child: const Text('Start'),
        ),
      ),
    );
  }
}
