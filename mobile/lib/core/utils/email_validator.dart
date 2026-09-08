class EmailValidator {
  EmailValidator._();

  static const Map<String, String> commonDomainTypos = {
    'gmial.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmaik.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmeil.com': 'gmail.com',
    'gmaul.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.cm': 'gmail.com',
    'gmail.cmo': 'gmail.com',
    'gmail.comm': 'gmail.com',
    'gmail.com.com': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yaho.co.in': 'yahoo.co.in',
    'yahoo.con': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
    'hotmai.com': 'hotmail.com',
    'hotmaill.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'hotmail.co': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'outlook.con': 'outlook.com',
    'outlook.co': 'outlook.com',
    'outlock.com': 'outlook.com',
    'iclud.com': 'icloud.com',
    'icoud.com': 'icloud.com',
    'icloud.con': 'icloud.com',
    'icloud.co': 'icloud.com',
    'redifmail.com': 'rediffmail.com',
    'rediff.com': 'rediffmail.com',
    'rediffmail.con': 'rediffmail.com',
  };

  static const Set<String> invalidTlds = {
    'con',
    'cmo',
    'coom',
    'cm',
    'ocm',
    'comm',
  };

  static String? validate(String? value, {String emptyMessage = 'Enter your email address'}) {
    final v = value?.trim().toLowerCase() ?? '';
    if (v.isEmpty) return emptyMessage;

    // Strict regex
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$',
    );

    if (!emailRegex.hasMatch(v) || v.contains('..')) {
      return 'Enter a valid email address (e.g. name@example.com)';
    }

    final parts = v.split('@');
    if (parts.length != 2) {
      return 'Enter a valid email address';
    }

    final userPart = parts[0];
    final domain = parts[1];

    if (userPart.isEmpty || userPart.startsWith('.') || userPart.endsWith('.')) {
      return 'Enter a valid email username';
    }

    if (domain.isEmpty ||
        domain.length < 3 ||
        !domain.contains('.') ||
        domain.startsWith('.') ||
        domain.endsWith('.')) {
      return 'Enter a valid email domain';
    }

    final domainParts = domain.split('.');
    final tld = domainParts.last;
    if (tld.length < 2 || !RegExp(r'^[a-z]+$').hasMatch(tld)) {
      return 'Enter a valid email domain extension';
    }

    if (invalidTlds.contains(tld)) {
      return 'Misspelled domain ending (.$tld). Did you mean .com?';
    }

    final suggestion = commonDomainTypos[domain];
    if (suggestion != null) {
      return 'Invalid email. Did you mean "$userPart@$suggestion"?';
    }

    return null;
  }
}
