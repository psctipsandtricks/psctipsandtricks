# PSC Tips & Tricks — Flutter Mobile Application

This is the official **Flutter Mobile App** for the PSC Tips & Tricks ed-tech platform. It connects to the NestJS backend API (`apps/api`) for user authentication, live mock tests, real-time rank tracking, and e-book downloads.

---

## 📱 Features
- **Clean Architecture Layout**: Feature-based separation (`core/`, `features/`).
- **Color Theme**: Deep Navy (`#0F172A`) & Muted Gold (`#D4AF37`).
- **Live Mock Engine**: Integrated with NestJS WebSockets and Redis BullMQ rank calculation queues.
- **Configurable API Client**: Easily point to local or staging API endpoints via `.env` or `ApiService(baseUrl: "...")`.

---

## 🚀 Getting Started

### Prerequisites
- Flutter SDK `>= 3.0.0`
- Android Studio / Xcode / VS Code

### Run the App
```bash
cd mobile
flutter pub get
flutter run
```

### API Endpoint Configuration
- **Android Emulator**: `http://10.0.2.2:4000`
- **iOS Simulator**: `http://localhost:4000`
- **Physical Device**: Set your local machine's IP address (e.g. `http://192.168.1.15:4000`)
