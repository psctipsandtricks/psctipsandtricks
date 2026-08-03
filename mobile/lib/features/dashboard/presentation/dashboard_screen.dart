import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance Dashboard'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Current State Rank', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                        SizedBox(height: 4),
                        Text('#42', style: TextStyle(color: AppTheme.mutedGold, fontSize: 32, fontWeight: FontWeight.w900)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('Accuracy', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                        SizedBox(height: 4),
                        Text('84.2%', style: TextStyle(color: AppTheme.emeraldAccent, fontSize: 24, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Recent Test Performances', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                title: const Text('Kerala PSC LDC Mock', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                subtitle: const Text('Score: 82.5 / 100 • Rank #42', style: TextStyle(color: AppTheme.textMuted)),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppTheme.emeraldAccent.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                  child: const Text('PASSED', style: TextStyle(color: AppTheme.emeraldAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
