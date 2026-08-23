import '../../core/network/api_client.dart';
import '../models/dashboard.dart';

class DashboardRepository {
  DashboardRepository(this._api);

  final ApiClient _api;

  Future<StudentDashboard> fetchDashboard() async {
    final res = await _api.get<Map<String, dynamic>>('/analytics/me/dashboard');
    return StudentDashboard.fromJson(res);
  }
}
