import 'package:intl/intl.dart';

/// Money, dates and durations, formatted the way the website presents them.
class Fmt {
  const Fmt._();

  static final _rupees = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );
  static final _dayMonth = DateFormat('d MMM');
  static final _dayMonthYear = DateFormat('d MMM yyyy');
  static final _dateTime = DateFormat('d MMM yyyy, h:mm a');
  static final _time = DateFormat('h:mm a');

  static String price(num? value) =>
      (value == null || value.isNaN || value.isInfinite || value <= 0)
          ? 'Free'
          : _rupees.format(value);

  /// Always shows the symbol, even at zero — for line items in an order summary
  /// where "Free" would read oddly next to a subtotal.
  static String amount(num? value) =>
      (value == null || value.isNaN || value.isInfinite)
          ? '₹0'
          : _rupees.format(value);

  static String date(DateTime? value) =>
      value == null ? '—' : _dayMonthYear.format(value);

  static String dateTime(DateTime? value) =>
      value == null ? '—' : _dateTime.format(value);

  static String timeOfDay(DateTime value) => _time.format(value);

  /// Chat-style stamp: the time for today, "Yesterday", then a short date.
  static String messageStamp(DateTime value) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(value.year, value.month, value.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return _time.format(value);
    if (diff == 1) return 'Yesterday';
    if (diff < 7) return DateFormat('EEEE').format(value);
    return _dayMonth.format(value);
  }

  static String relative(DateTime? value) {
    if (value == null) return '—';
    final diff = DateTime.now().difference(value);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return _dayMonth.format(value);
  }

  /// mm:ss for a live quiz timer, growing to h:mm:ss only when needed.
  static String clock(Duration d) {
    final negative = d.isNegative;
    final abs = d.abs();
    final hours = abs.inHours;
    final minutes = abs.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = abs.inSeconds.remainder(60).toString().padLeft(2, '0');
    final body = hours > 0 ? '$hours:$minutes:$seconds' : '$minutes:$seconds';
    return negative ? '-$body' : body;
  }

  /// "12m 05s" — how the result sheet reports time taken.
  static String elapsed(int seconds) {
    final m = seconds ~/ 60;
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '${m}m ${s}s';
  }

  /// Countdown to a scheduled mock test.
  static String untilStart(Duration d) {
    if (d.isNegative) return 'Started';
    if (d.inDays > 0) return 'in ${d.inDays}d ${d.inHours.remainder(24)}h';
    if (d.inHours > 0) return 'in ${d.inHours}h ${d.inMinutes.remainder(60)}m';
    if (d.inMinutes > 0) return 'in ${d.inMinutes}m';
    return 'starting now';
  }

  /// Trims a score's trailing ".0" so whole marks read as integers.
  static String marks(num? value) {
    if (value == null || value.isNaN || value.isInfinite) return '0';
    final rounded = (value * 100).round() / 100;
    return rounded == rounded.roundToDouble()
        ? rounded.toInt().toString()
        : rounded.toStringAsFixed(2);
  }

  static String percent(num? value, {int decimals = 0}) =>
      (value == null || value.isNaN || value.isInfinite)
          ? '0%'
          : '${value.toStringAsFixed(decimals)}%';

  static String count(int value, String singular, [String? plural]) =>
      '$value ${value == 1 ? singular : (plural ?? '${singular}s')}';
}
