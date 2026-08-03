import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Configurable API base URL (can be set via dotenv or fallback to localhost)
  final String baseUrl;
  String? _authToken;

  ApiService({this.baseUrl = 'http://10.0.2.2:4000'}); // 10.0.2.2 for Android Emulator, localhost for iOS

  void setAuthToken(String token) {
    _authToken = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_authToken != null) 'Authorization': 'Bearer $_authToken',
      };

  Future<dynamic> get(String endpoint) async {
    final response = await http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: _headers,
    );
    return _processResponse(response);
  }

  Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _processResponse(response);
  }

  dynamic _processResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body);
    } else {
      throw Exception('API Request Failed: ${response.statusCode} - ${response.body}');
    }
  }
}
