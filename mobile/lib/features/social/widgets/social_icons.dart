import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Pixel-perfect SVG vector icons for major social media platforms.
class SocialSvgIcons {
  const SocialSvgIcons._();

  static const String youtubeSvg = '''
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
  <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round" />
</svg>
''';

  static const String telegramSvg = '''
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <path d="M21.5 3.5 2.75 10.8c-.9.35-.89 1.63.02 1.96l4.62 1.7 1.78 5.72c.24.77 1.22.98 1.76.38l2.55-2.83 4.7 3.47c.7.52 1.71.14 1.9-.72l3.02-14.03c.2-.94-.75-1.72-1.63-1.35Z" />
  <path d="M9.4 14.46 19.1 6.2" />
</svg>
''';

  static const String instagramSvg = '''
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
</svg>
''';

  static const String whatsappSvg = '''
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  <path d="M9.5 9a.5.5 0 0 0-.5.5v1.2a6.8 6.8 0 0 0 3.8 3.8h1.2a.5.5 0 0 0 .5-.5v-1.3a.5.5 0 0 0-.3-.46l-1.5-.64a.5.5 0 0 0-.54.13l-.52.52a5 5 0 0 1-2.23-2.23l.52-.52a.5.5 0 0 0 .13-.54l-.64-1.5A.5.5 0 0 0 9.5 9z"/>
</svg>
''';

  static const String facebookSvg = '''
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
</svg>
''';

  static const String twitterSvg = '''
<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
</svg>
''';

  static Widget youtube({double size = 24, Color color = Colors.white}) =>
      SvgPicture.string(youtubeSvg, width: size, height: size, colorFilter: ColorFilter.mode(color, BlendMode.srcIn));

  static Widget telegram({double size = 24, Color color = Colors.white}) =>
      SvgPicture.string(telegramSvg, width: size, height: size, colorFilter: ColorFilter.mode(color, BlendMode.srcIn));

  static Widget instagram({double size = 24, Color color = Colors.white}) =>
      SvgPicture.string(instagramSvg, width: size, height: size, colorFilter: ColorFilter.mode(color, BlendMode.srcIn));

  static Widget whatsapp({double size = 24, Color color = Colors.white}) =>
      SvgPicture.string(whatsappSvg, width: size, height: size, colorFilter: ColorFilter.mode(color, BlendMode.srcIn));

  static Widget facebook({double size = 24, Color color = Colors.white}) =>
      SvgPicture.string(facebookSvg, width: size, height: size, colorFilter: ColorFilter.mode(color, BlendMode.srcIn));

  static Widget twitter({double size = 24, Color color = Colors.white}) =>
      SvgPicture.string(twitterSvg, width: size, height: size, colorFilter: ColorFilter.mode(color, BlendMode.srcIn));
}
