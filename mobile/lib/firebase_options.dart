// File generated for psc-tips-and-tricks-a5209.
// ignore_for_file: type=lint
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
class DefaultFirebaseOptions {
  static const placeholder = 'REPLACE_WITH_FIREBASE_VALUE';

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android;
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAQKos3DCyllPpoVAhUsHqoGADk6MW6Vj0',
    appId: '1:313869157607:android:1f948ff39d3b2d33364e42',
    messagingSenderId: '313869157607',
    projectId: 'psc-tips-and-tricks-a5209',
    storageBucket: 'psc-tips-and-tricks-a5209.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAQKos3DCyllPpoVAhUsHqoGADk6MW6Vj0',
    appId: '1:313869157607:ios:1f948ff39d3b2d33364e42',
    messagingSenderId: '313869157607',
    projectId: 'psc-tips-and-tricks-a5209',
    storageBucket: 'psc-tips-and-tricks-a5209.firebasestorage.app',
    iosBundleId: 'com.psctipsandtricks.student',
  );

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBW4zh_niKKdJSjnMDeLTFkEbVEMzyeBPQ',
    appId: '1:313869157607:web:d57a8470123b68ac364e42',
    messagingSenderId: '313869157607',
    projectId: 'psc-tips-and-tricks-a5209',
    storageBucket: 'psc-tips-and-tricks-a5209.firebasestorage.app',
    authDomain: 'psc-tips-and-tricks-a5209.firebaseapp.com',
    measurementId: 'G-H1ZC941Z8L',
  );
}
