# PSC Tips & Tricks — Student App (Flutter / Android)

The student side of the PSC Tips & Tricks platform, as a native Android app.

It talks to the **existing NestJS API** (`apps/api`) and the existing database.
There is no second backend, no duplicated student data, and no admin surface —
every admin and staff endpoint is simply not called from here.

## Running it

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

`10.0.2.2` is the Android emulator's alias for the host machine's `localhost`,
where `npm run dev` serves the API. On a physical device, point it at your
machine's LAN address or a deployed API.

| define | default | purpose |
| --- | --- | --- |
| `API_BASE_URL` | `http://10.0.2.2:4000` | The NestJS API. |
| `SOCKET_URL` | same as `API_BASE_URL` | Socket.IO endpoint for community chat. |
| `RAZORPAY_KEY_ID` | *(empty)* | Fallback publishable key. The server returns a `keyId` on each created order and that one wins. |

Release build:

```bash
flutter build apk --release --split-per-abi --dart-define=API_BASE_URL=https://your-api-host
```

Per-ABI APKs land around 24–29 MB. The release build has R8 enabled;
`android/app/proguard-rules.pro` keeps the classes Razorpay resolves by
reflection, which R8 would otherwise strip and silently break payments with.

> The release `signingConfig` still points at the debug keystore. Replace it
> with a real upload key before publishing to Play.

## Layout

```
lib/
  core/
    config/      API base URL and other build-time defines
    network/     Dio client — bearer auth, one-shot refresh-and-retry on 401
    storage/     Encrypted token store (the student session only)
    providers/   Riverpod DI graph, auth controller, theme controller
    router/      go_router: 5-tab stateful shell + auth redirects
    theme/       The website's "cyber glass" palette, light and dark
    widgets/     Shared kit — cards, badges, skeletons, error/empty states
    utils/       Defensive JSON readers, formatters
  data/
    models/      Mirrors packages/shared-types
    repositories/ One per API domain
  features/
    auth books quizzes mock_tests videos pdfs community
    dashboard home notifications orders profile checkout shell
```

Each feature owns its screens, its widgets, and its Riverpod providers.
Repositories are the only thing that touches `ApiClient`.

## What's in it

Everything on the student side of the website:

- **Auth** — email sign-in and registration, plus Google and Apple through the
  existing `/auth/:provider` handshake, run in an in-app browser. The final
  redirect to the web app is intercepted and cancelled, so the website never
  has to load and need not even be reachable from the device.
- **Home** — announcements, book and quiz rails, resume-reading, quick access.
- **E-Books** — catalog with search and category filters, detail with contents,
  and the multimedia reader: audio narration with speed control, YouTube class
  videos, attached PDF notes, a contents drawer and saved reading progress.
- **Quiz Hub** — the nested folder drill-down, cross-folder search, the attempt
  engine (countdown, question grid, reveal-on-select, negative marking), the
  result sheet, answer review, and full attempt history.
- **Mock tests** — upcoming/live/completed, join, and rank lists.
- **Library** — the video and PDF libraries, browsed Exam → Chapter → item.
- **Community** — study groups over Socket.IO, with polls and read receipts.
- **Progress** — the analytics dashboard: streaks, score trend, subject
  strengths, books in progress.
- **Account** — profile and avatar, orders, notifications, theme.
- **Checkout** — Razorpay, with coupon validation, mirroring the server's
  pricing rule so the total shown is the amount charged.

## Notes on behaviour that mirrors the website

- **Quiz scoring is computed locally on submit** for an instant result, then
  persisted in the background — the same trade-off the site makes, so a student
  never waits on the network to see how they did.
- **Attempt progress is stored on the device**, keyed to the attempt id, because
  the backend only persists answers on final submit.
- **Reading progress is "furthest reached"**, never the live position, so
  scrolling back to re-read cannot undo what's already been read.
- **Premium content stays server-gated.** A locked quiz arrives with no
  questions at all; the paywall has nothing to leak.

## Tests

```bash
flutter test
```

Covers negative-marking arithmetic, reader unit flattening and resume
resolution, coupon capping, and the formatters.
