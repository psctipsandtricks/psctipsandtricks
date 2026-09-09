import '../../core/config/app_config.dart';

/// Social media links configured for PSC Tips & Tricks.
class SocialLinks {
  const SocialLinks({
    this.telegramUrl,
    this.instagramUrl,
    this.youtubeUrl,
    this.facebookUrl,
    this.twitterUrl,
    this.playStoreUrl,
    this.appStoreUrl,
    this.whatsappUrl,
  });

  final String? telegramUrl;
  final String? instagramUrl;
  final String? youtubeUrl;
  final String? facebookUrl;
  final String? twitterUrl;
  final String? playStoreUrl;
  final String? appStoreUrl;
  final String? whatsappUrl;

  /// Default official links for PSC Tips & Tricks. Used as fallback when offline
  /// or when the backend values are unpopulated.
  factory SocialLinks.defaults() {
    return const SocialLinks(
      telegramUrl: 'https://telegram.me/psctipsandtricksyoutube',
      instagramUrl: 'https://www.instagram.com/psctipsandtricks/',
      youtubeUrl: 'https://www.youtube.com/@Psctipsandtricks',
      whatsappUrl: AppConfig.supportWhatsApp,
      playStoreUrl:
          'https://play.google.com/store/apps/details?id=com.psctipsandtricks',
      appStoreUrl:
          'https://apps.apple.com/in/app/psc-tips-and-tricks/id6759920014',
    );
  }

  factory SocialLinks.fromJson(Map<String, dynamic> json) {
    return SocialLinks(
      telegramUrl: json['telegramUrl'] as String?,
      instagramUrl: json['instagramUrl'] as String?,
      youtubeUrl: json['youtubeUrl'] as String?,
      facebookUrl: json['facebookUrl'] as String?,
      twitterUrl: json['twitterUrl'] as String?,
      playStoreUrl: json['playStoreUrl'] as String?,
      appStoreUrl: json['appStoreUrl'] as String?,
      whatsappUrl: (json['whatsappUrl'] as String?) ?? AppConfig.supportWhatsApp,
    );
  }

  Map<String, dynamic> toJson() => {
        'telegramUrl': telegramUrl,
        'instagramUrl': instagramUrl,
        'youtubeUrl': youtubeUrl,
        'facebookUrl': facebookUrl,
        'twitterUrl': twitterUrl,
        'playStoreUrl': playStoreUrl,
        'appStoreUrl': appStoreUrl,
        'whatsappUrl': whatsappUrl,
      };

  SocialLinks copyWith({
    String? telegramUrl,
    String? instagramUrl,
    String? youtubeUrl,
    String? facebookUrl,
    String? twitterUrl,
    String? playStoreUrl,
    String? appStoreUrl,
    String? whatsappUrl,
  }) {
    return SocialLinks(
      telegramUrl: telegramUrl ?? this.telegramUrl,
      instagramUrl: instagramUrl ?? this.instagramUrl,
      youtubeUrl: youtubeUrl ?? this.youtubeUrl,
      facebookUrl: facebookUrl ?? this.facebookUrl,
      twitterUrl: twitterUrl ?? this.twitterUrl,
      playStoreUrl: playStoreUrl ?? this.playStoreUrl,
      appStoreUrl: appStoreUrl ?? this.appStoreUrl,
      whatsappUrl: whatsappUrl ?? this.whatsappUrl,
    );
  }
}
