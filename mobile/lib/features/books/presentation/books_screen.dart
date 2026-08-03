import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class BooksScreen extends StatelessWidget {
  const BooksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('E-Books & Handbooks'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildBookCard(
            'Kerala PSC Master Question Bank 2026',
            '10,000+ Previous Year Questions with shortcuts',
            '₹299',
          ),
          _buildBookCard(
            'Indian Constitution & Polity Guide',
            'Articles, Amendments & Landmark Judgements',
            '₹199',
          ),
        ],
      ),
    );
  }

  Widget _buildBookCard(String title, String desc, String price) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 70,
              decoration: BoxDecoration(
                color: Colors.indigo.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.indigoAccent),
              ),
              child:
                  const Icon(Icons.picture_as_pdf, color: AppTheme.mutedGold),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text(desc,
                      style: const TextStyle(
                          color: AppTheme.textMuted, fontSize: 12)),
                  const SizedBox(height: 6),
                  Text(price,
                      style: const TextStyle(
                          color: AppTheme.mutedGold,
                          fontWeight: FontWeight.w800,
                          fontSize: 16)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
