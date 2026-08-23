import '../../core/utils/json.dart';

enum UserRole { student, staff, admin }

UserRole _roleFrom(dynamic v) {
  switch (J.str(v).toUpperCase()) {
    case 'ADMIN':
      return UserRole.admin;
    case 'STAFF':
      return UserRole.staff;
    default:
      return UserRole.student;
  }
}

class User {
  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.isPremium,
    required this.isSuspended,
    this.avatarUrl,
    this.phoneNumber,
    this.createdAt,
  });

  final String id;
  final String email;
  final String name;
  final UserRole role;
  final bool isPremium;
  final bool isSuspended;
  final String? avatarUrl;
  final String? phoneNumber;
  final DateTime? createdAt;

  /// Display initials for the fallback avatar.
  String get initials {
    final source = name.trim().isNotEmpty ? name.trim() : email;
    final parts = source.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: J.str(json['id']),
        email: J.str(json['email']),
        name: J.str(json['name']),
        role: _roleFrom(json['role']),
        isPremium: J.boolVal(json['isPremium']),
        isSuspended: J.str(json['status']).toUpperCase() == 'SUSPENDED',
        avatarUrl: J.strOrNull(json['avatarUrl']),
        phoneNumber: J.strOrNull(json['phoneNumber']),
        createdAt: J.dateOrNull(json['createdAt']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role.name.toUpperCase(),
        'isPremium': isPremium,
        'status': isSuspended ? 'SUSPENDED' : 'ACTIVE',
        'avatarUrl': avatarUrl,
        'phoneNumber': phoneNumber,
        'createdAt': createdAt?.toIso8601String(),
      };

  User copyWith({
    String? name,
    String? avatarUrl,
    String? phoneNumber,
    bool? isPremium,
  }) =>
      User(
        id: id,
        email: email,
        name: name ?? this.name,
        role: role,
        isPremium: isPremium ?? this.isPremium,
        isSuspended: isSuspended,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        phoneNumber: phoneNumber ?? this.phoneNumber,
        createdAt: createdAt,
      );
}

/// `GET /users/:id` — the signed-in student's own profile, with the extra
/// counters and linked-identity details the profile screen shows.
class UserProfile {
  const UserProfile({
    required this.user,
    required this.oauthProviders,
    required this.ordersCount,
    required this.quizAttemptsCount,
    this.googleAvatarUrl,
  });

  final User user;
  final List<String> oauthProviders;
  final int ordersCount;
  final int quizAttemptsCount;
  final String? googleAvatarUrl;

  /// How this account signs in — mirrors the web's `determineLoginMethod`.
  String get loginMethod {
    if (oauthProviders.contains('GOOGLE')) return 'Google';
    if (oauthProviders.contains('APPLE')) return 'Apple';
    return 'Email';
  }

  String? get displayAvatar => user.avatarUrl ?? googleAvatarUrl;

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        user: User.fromJson(json),
        oauthProviders: (json['oauthIdentities'] is List)
            ? (json['oauthIdentities'] as List)
                .whereType<Map>()
                .map((e) => J.str(e['provider']).toUpperCase())
                .toList()
            : const [],
        ordersCount: J.intVal(json['ordersCount']),
        quizAttemptsCount: J.intVal(json['quizAttemptsCount']),
        googleAvatarUrl: J.strOrNull(json['googleAvatarUrl']),
      );
}

class AuthResponse {
  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final User user;

  factory AuthResponse.fromJson(Map<String, dynamic> json) => AuthResponse(
        accessToken: J.str(json['accessToken']),
        refreshToken: J.str(json['refreshToken']),
        user: User.fromJson(J.map(json['user'])),
      );
}
