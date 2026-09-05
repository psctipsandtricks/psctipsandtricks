import '../../core/network/api_client.dart';
import '../models/app_update_config.dart';

class AppUpdateRepository {
  AppUpdateRepository(this._api);

  final ApiClient _api;

  /// Public — no session needed. Android-only for now; `platform` is a query
  /// param rather than a path segment so iOS is a value away, not a route.
  Future<AppUpdateConfig> fetchConfig() async {
    final res = await _api.get<Map<String, dynamic>>(
      '/app/update-config',
      query: const {'platform': 'android'},
    );
    return AppUpdateConfig.fromJson(res);
  }
}
