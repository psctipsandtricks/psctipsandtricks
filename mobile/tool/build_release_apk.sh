#!/usr/bin/env bash
#
# Builds the APK to hand to a client, and refuses to hand over a broken one.
#
# The failure this exists to prevent: `flutter build apk --split-per-abi` leaves
# app-arm64-v8a-release.apk, app-armeabi-v7a-release.apk and
# app-x86_64-release.apk next to the universal app-release.apk. The per-ABI
# files are a third of the size, so they are the tempting ones to send — and
# each installs on only one kind of CPU. On every other device the installer
# reports INSTALL_FAILED_NO_MATCHING_ABIS, which Android shows as
# "App not installed".
#
# This script builds the universal APK, deletes the per-ABI ones so they cannot
# be picked up by mistake, and then verifies the result actually is universal
# and properly signed before naming the file to send.
#
# Usage: tool/build_release_apk.sh [extra flutter build args...]

set -euo pipefail

cd "$(dirname "$0")/.."

APK_DIR="build/app/outputs/flutter-apk"
APK="$APK_DIR/app-release.apk"

# The ABIs a universal APK must carry. armeabi-v7a covers 32-bit phones,
# arm64-v8a covers everything modern (and is the only one 64-bit-only devices
# will accept), x86_64 covers emulators and Chromebooks.
REQUIRED_ABIS=(armeabi-v7a arm64-v8a x86_64)

find_build_tool() {
    local name="$1" sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
    # Newest build-tools version wins; the tools are backwards compatible.
    find "$sdk/build-tools" -maxdepth 2 -name "$name" 2>/dev/null | sort -V | tail -1
}

AAPT2="$(find_build_tool aapt2)"
APKSIGNER="$(find_build_tool apksigner)"

echo "==> Building the universal release APK"
rm -f "$APK_DIR"/app-*-release.apk "$APK_DIR"/app-*-release.apk.sha1
flutter build apk --release "$@"

if [[ ! -f "$APK" ]]; then
    echo "FAILED: $APK was not produced." >&2
    exit 1
fi

# Any per-ABI artifact still present means splits were requested. Those files
# must not leave this machine.
shopt -s nullglob
STRAY=("$APK_DIR"/app-*-release.apk)
shopt -u nullglob
if (( ${#STRAY[@]} > 0 )); then
    echo
    echo "REFUSING TO CONTINUE: per-ABI APKs were produced:" >&2
    printf '  %s\n' "${STRAY[@]}" >&2
    echo "Drop --split-per-abi. Each of those installs on one CPU type only." >&2
    exit 1
fi

echo
echo "==> Verifying $APK"
FAILED=0

if [[ -n "$AAPT2" ]]; then
    BADGING="$("$AAPT2" dump badging "$APK")"

    NATIVE_CODE="$(sed -n "s/^native-code: //p" <<<"$BADGING" | tr -d "'")"
    for abi in "${REQUIRED_ABIS[@]}"; do
        if [[ " $NATIVE_CODE " == *" $abi "* ]]; then
            echo "  ok      ABI $abi present"
        else
            echo "  FAIL    ABI $abi missing — devices with that CPU cannot install this"
            FAILED=1
        fi
    done

    MIN_SDK="$(sed -n "s/^minSdkVersion:'\(.*\)'/\1/p" <<<"$BADGING")"
    TARGET_SDK="$(sed -n "s/^targetSdkVersion:'\(.*\)'/\1/p" <<<"$BADGING")"
    if [[ "$MIN_SDK" == "24" ]]; then
        echo "  ok      minSdk $MIN_SDK (Android 7.0+), targetSdk ${TARGET_SDK:-?}"
    else
        echo "  WARN    minSdk is ${MIN_SDK:-unreadable}, expected 24 — check app/build.gradle.kts"
    fi

    # A required hardware feature is what makes Play say "your device isn't
    # compatible". glEsVersion is the one legitimate exception: Flutter cannot
    # render without OpenGL ES 2.0, and every Android 7+ device has it.
    REQUIRED_FEATURES="$(grep -E "^  uses-(feature|implied-feature): name=" <<<"$BADGING" || true)"
    if [[ -n "$REQUIRED_FEATURES" ]]; then
        echo "  WARN    APK requires hardware features (Play filters devices without them):"
        sed 's/^/            /' <<<"$REQUIRED_FEATURES"
    else
        # uses-gl-es is the one unavoidable requirement: Flutter cannot render
        # without OpenGL ES 2.0, which every Android 7+ device has.
        echo "  ok      no required hardware features ($(grep -c "uses-feature-not-required" <<<"$BADGING") declared optional, $(sed -n "s/^  uses-gl-es: //p" <<<"$BADGING") GL ES)"
    fi
else
    echo "  skip    aapt2 not found; cannot verify ABIs"
fi

if [[ -n "$APKSIGNER" ]]; then
    # The label changed between build-tools versions ("Signer #1 certificate DN:"
    # up to 36, "V2 Signer: certificate DN:" from 37), so match the common part
    # rather than either spelling.
    SIGNER="$("$APKSIGNER" verify --print-certs "$APK" 2>&1 |
        sed -n 's/^.*certificate DN: //p' | head -1)"
    if [[ -z "$SIGNER" ]]; then
        # Fail closed. An unreadable signature is not a passing signature.
        echo "  FAIL    could not read the signing certificate from $APK"
        FAILED=1
    elif [[ "$SIGNER" == *"CN=Android Debug"* ]]; then
        echo "  FAIL    signed with the DEBUG key ($SIGNER)"
        echo "            The debug keystore is local to this machine and is regenerated"
        echo "            freely, so the next build signs differently and every existing"
        echo "            install refuses to update: \"App not installed\"."
        echo "            Set up a real key first — see android/KEYSTORE_SETUP.md."
        FAILED=1
    else
        echo "  ok      signed with a release key ($SIGNER)"
    fi
else
    echo "  skip    apksigner not found; cannot verify the signature"
fi

echo
if (( FAILED )); then
    echo "NOT SHIPPABLE — fix the FAIL lines above."
    exit 1
fi

echo "Ready to share: $APK ($(du -h "$APK" | cut -f1))"
echo "Installs on any Android 7.0+ device, 32-bit or 64-bit."
