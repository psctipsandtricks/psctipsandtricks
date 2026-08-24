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

## Navigation shell

The bottom bar is a floating capsule rather than a full-width strip, with the
active tab carrying a lighter lozenge so the current section reads at a glance
without relying on colour alone. The home header follows the same language:
brand mark on the left, circular actions on the right, and a scrolling
icon-over-label shortcut strip beneath it for the surfaces that do not own a
tab (progress, mock tests, community, attempts, library, orders).

The strip lives in the app bar's `bottom` slot, so it scrolls away with the
header and gives the hero panel the full screen on the way down.

## Offline books

A book the student currently has access to can be saved to the device and read
with no connection.

**What gets stored.** The chapter tree from `/books/:id/reader`, plus every
audio narration and PDF it references, plus the cover. YouTube class videos are
deliberately not stored — they stream from YouTube and cannot be cached — so a
topic whose only media is a video says so rather than offering a dead thumbnail.

**Where, and how safely.** Files live under `getApplicationSupportDirectory()`,
inside `/data/data/<package>` — unreadable by other apps and invisible to
MediaStore. Every file is AES-256-CTR encrypted under a key minted on first use
and held in the platform keystore, so a pulled data directory yields ciphertext.
Names are SHA-256 digests with a neutral `.bin` extension, so the directory
listing reveals neither which book nor what kind of file. `allowBackup` is off
and `data_extraction_rules.xml` excludes the vault, so the ciphertext cannot
leave the device in a cloud or device-to-device transfer either.

CTR rather than GCM is the deliberate choice: it is a stream cipher, so bytes
are encrypted as they arrive and an interrupted transfer resumes by seeking the
keystream to the byte offset already on disk. `offline_test.dart` pins that
down — a file encrypted in one pass and the same file encrypted across seven
interruptions produce identical ciphertext.

**Resuming.** Each asset streams into a `.part` file and is promoted only when
whole, so the manifest never claims a half-written file is usable. A resumed
transfer sends `Range: bytes=N-`; a server that answers 200 instead of 206 is
detected and the file restarts cleanly rather than being spliced. The manifest
is checkpointed after every completed file, so a process death re-fetches
nothing already finished, and a resumed download reconciles against a freshly
fetched asset list so a book that gained a chapter picks the new media up.

**Staying honest about access.** A download is a cached copy of something the
server still owns the decision about. `POST /books/:id/download` — the same gate
the website uses — is what authorises the download, so the app cannot widen
entitlement by getting a local check wrong. The copy then carries a lease with
two independent locks:

- the purchase's own `validTill`, taken from `access.subscription`, and
- a check-in deadline: seven days without hearing from the server and the book
  locks itself pending verification.

Either one lapsing makes the local copy unreadable, and the reader falls back to
the network — where the server's access check applies as normal. A network
failure never expires a lease: being offline is not evidence that a purchase
lapsed. Leases refresh whenever the app comes to the foreground, so the lock
screen stays rare in normal use.

Deleting a download frees the space and can be re-downloaded at any time while
access is valid.

**States.** The book detail panel and the Downloads screen both show Download,
Downloading (with progress), Paused, Downloaded, Verify access, Access expired,
and Failed.

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
