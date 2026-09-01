# Release signing key

Release builds currently fall back to the **debug** keystore, and an APK signed
with it must not be distributed. The debug key lives in `~/.android/debug.keystore`,
is specific to one machine, and Android tooling recreates it without warning. As
soon as the APK is rebuilt somewhere else — a second laptop, a fresh machine, CI —
it carries a different signature, and Android refuses to install it over the copy
a student already has:

> App not installed

That is unrecoverable for the user except by uninstalling first, which wipes
their downloads and login. Creating a real key once fixes it permanently.

## 1. Create the key

Run this yourself — it will prompt for a password, and the key must never be
committed or shared:

```bash
keytool -genkey -v -keystore ~/psc-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Keep `~/psc-upload-key.jks` and its password backed up somewhere safe. **If the
key is lost, no future build can ever update the apps already installed** — every
student would have to uninstall and reinstall.

## 2. Point the build at it

Create `android/key.properties` (gitignored, never committed):

```properties
storePassword=<the store password you chose>
keyPassword=<the key password you chose>
keyAlias=upload
storeFile=/Users/<you>/psc-upload-key.jks
```

`storeFile` may be absolute, or relative to the `android/` directory.

`app/build.gradle.kts` picks the file up automatically. With it present, release
builds are signed with your key; without it they fall back to the debug key and
print a warning.

## 3. Build

```bash
tool/build_release_apk.sh
```

The script verifies the signature before telling you the APK is shippable.

## Note on key rotation

The signing config enables APK Signature Scheme v3, which supports rotating to a
new key later without forcing a reinstall. That only works if v3 was in place on
the *original* install — which is why it is enabled from the start.
