import '../../core/utils/json.dart';

/// What kind of file an offline asset is, which decides the extension it gets
/// when decrypted for a native viewer.
enum OfflineAssetKind { cover, audio, pdf }

OfflineAssetKind _kindFrom(dynamic v) {
  switch (J.str(v)) {
    case 'audio':
      return OfflineAssetKind.audio;
    case 'pdf':
      return OfflineAssetKind.pdf;
    default:
      return OfflineAssetKind.cover;
  }
}

extension OfflineAssetKindX on OfflineAssetKind {
  String get extension => switch (this) {
        OfflineAssetKind.cover => 'jpg',
        OfflineAssetKind.audio => 'mp3',
        OfflineAssetKind.pdf => 'pdf',
      };
}

/// One downloadable file belonging to a book.
class OfflineAsset {
  const OfflineAsset({
    required this.id,
    required this.remoteUrl,
    required this.kind,
    this.bytes = 0,
    this.complete = false,
  });

  /// Opaque, stable file name inside the vault.
  final String id;
  final String remoteUrl;
  final OfflineAssetKind kind;

  /// Bytes on disk once finished; 0 while still transferring.
  final int bytes;
  final bool complete;

  OfflineAsset copyWith({int? bytes, bool? complete}) => OfflineAsset(
        id: id,
        remoteUrl: remoteUrl,
        kind: kind,
        bytes: bytes ?? this.bytes,
        complete: complete ?? this.complete,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'remoteUrl': remoteUrl,
        'kind': kind.name,
        'bytes': bytes,
        'complete': complete,
      };

  factory OfflineAsset.fromJson(Map<String, dynamic> json) => OfflineAsset(
        id: J.str(json['id']),
        remoteUrl: J.str(json['remoteUrl']),
        kind: _kindFrom(json['kind']),
        bytes: J.intVal(json['bytes']),
        complete: J.boolVal(json['complete']),
      );
}

/// The entitlement an offline copy was taken under.
///
/// A download is a cached copy of something the server still owns the decision
/// about, so the lease records both when the purchase lapses and when the app
/// last heard from the server. Either one going stale locks the book.
class OfflineLease {
  const OfflineLease({
    required this.grantedAt,
    required this.lastVerifiedAt,
    this.validTill,
    this.revoked = false,
  });

  final DateTime grantedAt;

  /// The last time the server confirmed this student still has access.
  final DateTime lastVerifiedAt;

  /// When the purchase lapses, or null for a lifetime purchase.
  final DateTime? validTill;

  /// Set when the server has explicitly said access is gone.
  final bool revoked;

  /// How long an offline copy stays readable without hearing from the server.
  ///
  /// Long enough to cover a study trip with no signal; short enough that a
  /// refund or an expiry cannot be dodged indefinitely by staying offline.
  static const revalidateAfter = Duration(days: 7);

  bool get isExpired =>
      revoked || (validTill != null && DateTime.now().isAfter(validTill!));

  /// True once the copy has gone too long without a server check-in.
  bool get needsRevalidation =>
      DateTime.now().difference(lastVerifiedAt) > revalidateAfter;

  /// Days left before the book locks itself pending a check-in.
  int get daysUntilRevalidation {
    final deadline = lastVerifiedAt.add(revalidateAfter);
    final left = deadline.difference(DateTime.now()).inDays;
    return left < 0 ? 0 : left;
  }

  OfflineLease copyWith({
    DateTime? lastVerifiedAt,
    DateTime? validTill,
    bool? revoked,
    bool clearValidTill = false,
  }) =>
      OfflineLease(
        grantedAt: grantedAt,
        lastVerifiedAt: lastVerifiedAt ?? this.lastVerifiedAt,
        validTill: clearValidTill ? null : (validTill ?? this.validTill),
        revoked: revoked ?? this.revoked,
      );

  Map<String, dynamic> toJson() => {
        'grantedAt': grantedAt.toIso8601String(),
        'lastVerifiedAt': lastVerifiedAt.toIso8601String(),
        'validTill': validTill?.toIso8601String(),
        'revoked': revoked,
      };

  factory OfflineLease.fromJson(Map<String, dynamic> json) => OfflineLease(
        grantedAt: J.dateOrNull(json['grantedAt']) ?? DateTime.now(),
        lastVerifiedAt:
            J.dateOrNull(json['lastVerifiedAt']) ?? DateTime.now(),
        validTill: J.dateOrNull(json['validTill']),
        revoked: J.boolVal(json['revoked']),
      );
}

/// What the UI shows for a book's offline copy.
enum OfflineStatus {
  /// No local copy; offer a download if the student has access.
  none,

  /// Transfer in flight.
  downloading,

  /// Started and stoppable — either the student paused it or it was cut off.
  paused,

  /// Complete and readable offline.
  ready,

  /// Complete, but the entitlement lapsed or the server revoked it.
  expired,

  /// Complete, but too long since the last server check-in.
  needsRevalidation,

  /// The transfer stopped on an error and can be retried.
  failed,
}

/// The manifest written alongside a downloaded book: everything needed to open
/// it with no network at all.
class OfflineBook {
  const OfflineBook({
    required this.bookId,
    required this.title,
    required this.author,
    required this.category,
    required this.coverAssetId,
    required this.readerJson,
    required this.assets,
    required this.lease,
    required this.downloadedAt,
    this.totalBytes = 0,
    this.complete = false,
  });

  final String bookId;
  final String title;
  final String author;
  final String category;

  /// Asset id of the cover, so the library can render without the network.
  final String coverAssetId;

  /// The verbatim `/books/:id/reader` payload, so the offline reader builds the
  /// exact same chapter tree the online one does.
  final Map<String, dynamic> readerJson;

  final List<OfflineAsset> assets;
  final OfflineLease lease;
  final DateTime downloadedAt;
  final int totalBytes;
  final bool complete;

  /// Maps a remote media URL back to its local asset, so the reader can swap in
  /// the offline copy without the rest of the screen knowing.
  OfflineAsset? assetForUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    for (final asset in assets) {
      if (asset.remoteUrl == url && asset.complete) return asset;
    }
    return null;
  }

  OfflineStatus get status {
    if (!complete) return OfflineStatus.paused;
    if (lease.isExpired) return OfflineStatus.expired;
    if (lease.needsRevalidation) return OfflineStatus.needsRevalidation;
    return OfflineStatus.ready;
  }

  /// Whether the book may be opened from disk right now.
  bool get isReadable => status == OfflineStatus.ready;

  OfflineBook copyWith({
    List<OfflineAsset>? assets,
    OfflineLease? lease,
    int? totalBytes,
    bool? complete,
  }) =>
      OfflineBook(
        bookId: bookId,
        title: title,
        author: author,
        category: category,
        coverAssetId: coverAssetId,
        readerJson: readerJson,
        assets: assets ?? this.assets,
        lease: lease ?? this.lease,
        downloadedAt: downloadedAt,
        totalBytes: totalBytes ?? this.totalBytes,
        complete: complete ?? this.complete,
      );

  Map<String, dynamic> toJson() => {
        'bookId': bookId,
        'title': title,
        'author': author,
        'category': category,
        'coverAssetId': coverAssetId,
        'readerJson': readerJson,
        'assets': assets.map((a) => a.toJson()).toList(),
        'lease': lease.toJson(),
        'downloadedAt': downloadedAt.toIso8601String(),
        'totalBytes': totalBytes,
        'complete': complete,
      };

  factory OfflineBook.fromJson(Map<String, dynamic> json) => OfflineBook(
        bookId: J.str(json['bookId']),
        title: J.str(json['title']),
        author: J.str(json['author']),
        category: J.str(json['category']),
        coverAssetId: J.str(json['coverAssetId']),
        readerJson: J.map(json['readerJson']),
        assets: J.list(json['assets'], OfflineAsset.fromJson),
        lease: OfflineLease.fromJson(J.map(json['lease'])),
        downloadedAt: J.dateOrNull(json['downloadedAt']) ?? DateTime.now(),
        totalBytes: J.intVal(json['totalBytes']),
        complete: J.boolVal(json['complete']),
      );
}

/// Live state of one transfer, surfaced to the download button and the
/// Downloads screen.
class DownloadProgress {
  const DownloadProgress({
    required this.bookId,
    required this.status,
    this.receivedBytes = 0,
    this.totalBytes = 0,
    this.completedAssets = 0,
    this.totalAssets = 0,
    this.currentAssetFraction = 0,
    this.error,
  });

  final String bookId;
  final OfflineStatus status;
  final int receivedBytes;
  final int totalBytes;
  final int completedAssets;
  final int totalAssets;

  /// How far into the asset currently transferring, 0–1.
  final double currentAssetFraction;
  final String? error;

  bool get isActive => status == OfflineStatus.downloading;

  /// 0–1, or null before the asset list is known so the UI can show an
  /// indeterminate bar rather than one stuck at zero.
  ///
  /// Measured in assets rather than bytes: the total byte count is not known
  /// until every file has been requested, and a bar whose maximum keeps growing
  /// reads as broken. Counting whole assets plus the fraction of the one in
  /// flight advances smoothly and never goes backwards.
  double? get fraction {
    if (totalAssets <= 0) return null;
    return ((completedAssets + currentAssetFraction) / totalAssets)
        .clamp(0.0, 1.0);
  }

  DownloadProgress copyWith({
    OfflineStatus? status,
    int? receivedBytes,
    int? totalBytes,
    int? completedAssets,
    int? totalAssets,
    double? currentAssetFraction,
    String? error,
    bool clearError = false,
  }) =>
      DownloadProgress(
        bookId: bookId,
        status: status ?? this.status,
        receivedBytes: receivedBytes ?? this.receivedBytes,
        totalBytes: totalBytes ?? this.totalBytes,
        completedAssets: completedAssets ?? this.completedAssets,
        totalAssets: totalAssets ?? this.totalAssets,
        currentAssetFraction:
            currentAssetFraction ?? this.currentAssetFraction,
        error: clearError ? null : (error ?? this.error),
      );
}

/// Human-readable byte size, e.g. "24.1 MB".
String formatBytes(int bytes) {
  if (bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  var value = bytes.toDouble();
  var unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return '${value.toStringAsFixed(value >= 10 || unit <= 1 ? 0 : 1)} ${units[unit]}';
}
