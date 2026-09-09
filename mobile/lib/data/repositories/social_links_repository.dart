import '../../core/network/api_client.dart';
import '../models/social_links.dart';

/// Repository for retrieving official social media and store links.
class SocialLinksRepository {
  SocialLinksRepository(this._api);

  final ApiClient _api;
  SocialLinks? _cached;

  /// Fetches the configured social media links. If the network is unreachable
  /// or returns an error, gracefully falls back to the default official channels.
  Future<SocialLinks> fetchSocialLinks({bool forceRefresh = false}) async {
    if (!forceRefresh && _cached != null) {
      return _cached!;
    }

    try {
      final res = await _api.get<Map<String, dynamic>>('/social-links');
      final fetched = SocialLinks.fromJson(res);
      final defaults = SocialLinks.defaults();

      // Merge fetched with defaults so any unconfigured link still has official fallback
      _cached = SocialLinks(
        telegramUrl: fetched.telegramUrl?.isNotEmpty == true
            ? fetched.telegramUrl
            : defaults.telegramUrl,
        instagramUrl: fetched.instagramUrl?.isNotEmpty == true
            ? fetched.instagramUrl
            : defaults.instagramUrl,
        youtubeUrl: fetched.youtubeUrl?.isNotEmpty == true
            ? fetched.youtubeUrl
            : defaults.youtubeUrl,
        facebookUrl: fetched.facebookUrl,
        twitterUrl: fetched.twitterUrl,
        whatsappUrl: fetched.whatsappUrl?.isNotEmpty == true
            ? fetched.whatsappUrl
            : defaults.whatsappUrl,
        playStoreUrl: fetched.playStoreUrl?.isNotEmpty == true
            ? fetched.playStoreUrl
            : defaults.playStoreUrl,
        appStoreUrl: fetched.appStoreUrl?.isNotEmpty == true
            ? fetched.appStoreUrl
            : defaults.appStoreUrl,
      );

      return _cached!;
    } catch (_) {
      // Graceful offline/error fallback
      return _cached ?? SocialLinks.defaults();
    }
  }
}
