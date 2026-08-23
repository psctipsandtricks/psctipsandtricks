import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../data/models/order.dart';

/// What is being bought. Exactly one of the two ids is set, matching the
/// `POST /orders` contract.
class PurchaseTarget {
  const PurchaseTarget.book({
    required this.id,
    required this.title,
    required this.price,
    this.imageUrl,
  }) : isBook = true;

  const PurchaseTarget.quiz({
    required this.id,
    required this.title,
    required this.price,
    this.imageUrl,
  }) : isBook = false;

  final String id;
  final String title;
  final double price;
  final String? imageUrl;
  final bool isBook;
}

/// Opens the checkout sheet. Resolves true only once the server has confirmed
/// the payment — the caller should refetch and unlock on that.
Future<bool> showPurchaseSheet(
  BuildContext context, {
  required PurchaseTarget target,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => PurchaseSheet(target: target),
  );
  return result ?? false;
}

class PurchaseSheet extends ConsumerStatefulWidget {
  const PurchaseSheet({super.key, required this.target});

  final PurchaseTarget target;

  @override
  ConsumerState<PurchaseSheet> createState() => _PurchaseSheetState();
}

class _PurchaseSheetState extends ConsumerState<PurchaseSheet> {
  final _couponController = TextEditingController();

  Razorpay? _razorpay;
  Coupon? _coupon;
  CreatedOrder? _pendingOrder;

  bool _paying = false;
  bool _checkingCoupon = false;
  String? _error;
  String? _couponError;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay?.clear();
    _couponController.dispose();
    super.dispose();
  }

  double get _basePrice => widget.target.price;
  double get _discount => _coupon?.discountOn(_basePrice) ?? 0;
  double get _payable {
    final net = _basePrice - _discount;
    return net < 0 ? 0 : net.roundToDouble();
  }

  Future<void> _applyCoupon() async {
    final code = _couponController.text.trim().toUpperCase();
    setState(() => _couponError = null);

    if (code.isEmpty) {
      setState(() => _couponError = 'Enter a coupon code');
      return;
    }
    if (!RegExp(r'^[A-Za-z0-9]+$').hasMatch(code)) {
      setState(() => _couponError = 'Coupon codes are letters and numbers only');
      return;
    }

    setState(() => _checkingCoupon = true);
    try {
      final coupon =
          await ref.read(ordersRepositoryProvider).validateCoupon(code);
      if (!mounted) return;
      setState(() {
        _coupon = coupon;
        _couponController.clear();
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _coupon = null;
          _couponError = e.message;
        });
      }
    } finally {
      if (mounted) setState(() => _checkingCoupon = false);
    }
  }

  Future<void> _pay() async {
    setState(() {
      _paying = true;
      _error = null;
    });

    try {
      final orders = ref.read(ordersRepositoryProvider);
      final order = await orders.createOrder(
        bookId: widget.target.isBook ? widget.target.id : null,
        quizId: widget.target.isBook ? null : widget.target.id,
        amount: _payable,
        couponCode: _coupon?.code,
      );
      _pendingOrder = order;

      // With no live Razorpay credentials the server issues a stand-in order;
      // settling it directly is what the website's test mode does too.
      if (order.isSimulated || order.amount <= 0) {
        await _settle(
          paymentId: 'pay_sim_${DateTime.now().millisecondsSinceEpoch}',
          razorpayOrderId: order.razorpayOrderId,
          signature: 'sig_sim_${DateTime.now().millisecondsSinceEpoch}',
        );
        return;
      }

      final key = order.keyId?.isNotEmpty == true
          ? order.keyId!
          : AppConfig.razorpayKeyId;
      if (key.isEmpty) {
        throw const ApiException(
          'Payments are not configured for this build. Please contact support.',
        );
      }

      final user = ref.read(currentUserProvider);
      _razorpay!.open({
        'key': key,
        // The server recomputes the price, so charge its amount, in paise.
        'amount': (order.amount * 100).round(),
        'currency': order.currency,
        'name': 'PSC Tips And Tricks',
        'description': widget.target.title,
        if (order.razorpayOrderId != null &&
            !order.razorpayOrderId!.startsWith('order_sim_'))
          'order_id': order.razorpayOrderId,
        'prefill': {
          'name': user?.name ?? '',
          'email': user?.email ?? '',
          if (user?.phoneNumber != null) 'contact': user!.phoneNumber,
        },
        'theme': {'color': '#06B6D4'},
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _paying = false;
          _error = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _paying = false;
          _error = 'Could not start the payment. Please try again.';
        });
      }
    }
  }

  void _onPaymentSuccess(PaymentSuccessResponse response) {
    unawaited(_settle(
      paymentId: response.paymentId ?? 'pay_${DateTime.now().millisecondsSinceEpoch}',
      razorpayOrderId: response.orderId ?? _pendingOrder?.razorpayOrderId,
      signature: response.signature,
    ));
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() {
      _paying = false;
      _error = response.message?.isNotEmpty == true
          ? response.message!
          : 'Payment failed or was cancelled. This stays locked until payment completes.';
    });
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    // The wallet app takes over; success still arrives on the success handler.
  }

  /// Verifies with the server — only its SUCCESS verdict unlocks the item.
  Future<void> _settle({
    required String paymentId,
    String? razorpayOrderId,
    String? signature,
  }) async {
    final order = _pendingOrder;
    if (order == null) return;
    try {
      final ok = await ref.read(ordersRepositoryProvider).verifyPayment(
            orderId: order.id,
            paymentId: paymentId,
            razorpayOrderId: razorpayOrderId,
            razorpaySignature:
                signature ?? 'sig_${DateTime.now().millisecondsSinceEpoch}',
          );
      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pop(true);
      } else {
        setState(() {
          _paying = false;
          _error = 'Payment verification failed. Please contact support.';
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _paying = false;
          _error = e.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: palette.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: AppColors.amber.withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Icon(
                    widget.target.isBook
                        ? Icons.menu_book_rounded
                        : Icons.workspace_premium_rounded,
                    color: AppColors.amber,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Unlock ${widget.target.isBook ? 'this book' : 'this question bank'}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: palette.textMuted,
                              letterSpacing: 0.4,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.target.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              height: 1.25,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Coupon
            if (_coupon == null)
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _couponController,
                      textCapitalization: TextCapitalization.characters,
                      enabled: !_paying,
                      decoration: InputDecoration(
                        hintText: 'Coupon code',
                        errorText: _couponError,
                        prefixIcon:
                            const Icon(Icons.local_offer_outlined, size: 19),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton(
                    onPressed: _checkingCoupon || _paying ? null : _applyCoupon,
                    child: _checkingCoupon
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Apply'),
                  ),
                ],
              )
            else
              GlassCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                borderColor: AppColors.emerald.withValues(alpha: 0.4),
                child: Row(
                  children: [
                    const Icon(Icons.verified_rounded,
                        color: AppColors.emerald, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${_coupon!.code} applied — ${_coupon!.discountPercent}% off',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.emerald,
                            ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 17),
                      onPressed: _paying
                          ? null
                          : () => setState(() => _coupon = null),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 18),

            // Summary
            _SummaryRow(label: 'Price', value: Fmt.amount(_basePrice)),
            if (_discount > 0) ...[
              const SizedBox(height: 8),
              _SummaryRow(
                label: 'Coupon discount',
                value: '− ${Fmt.amount(_discount)}',
                valueColor: AppColors.emerald,
              ),
            ],
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Divider(color: palette.border),
            ),
            _SummaryRow(
              label: 'Total payable',
              value: Fmt.amount(_payable),
              emphasise: true,
            ),
            const SizedBox(height: 18),

            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.rose.withValues(alpha: 0.10),
                  border:
                      Border.all(color: AppColors.rose.withValues(alpha: 0.32)),
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                ),
                child: Text(
                  _error!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.rose,
                        height: 1.4,
                      ),
                ),
              ),
              const SizedBox(height: 14),
            ],

            GradientButton(
              label: 'Pay ${Fmt.amount(_payable)}',
              icon: Icons.lock_rounded,
              gradient: AppColors.goldGradient,
              isLoading: _paying,
              onPressed: _paying ? null : _pay,
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.shield_outlined, size: 13, color: palette.textMuted),
                const SizedBox(width: 6),
                Text(
                  'Secured by Razorpay',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.emphasise = false,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool emphasise;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: (emphasise ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium)
              ?.copyWith(
            color: emphasise ? null : context.palette.textSecondary,
            fontWeight: emphasise ? FontWeight.w800 : null,
          ),
        ),
        Text(
          value,
          style: (emphasise ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium)
              ?.copyWith(
            color: valueColor ?? (emphasise ? AppColors.amber : null),
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}
