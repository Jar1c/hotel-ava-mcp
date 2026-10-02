/**
 * Device biometric gate for Quick Sign-In approvals (WebAuthn platform
 * authenticator — fingerprint / face / Windows Hello).
 *
 * First use registers a passkey (credential id cached in localStorage),
 * later uses assert against it. This is a device-local confirmation gesture:
 * the approve API call itself stays protected by the session token.
 */

const CRED_KEY = "hotelava_passkey_id"

export type BiometricResult = "ok" | "unsupported"

export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials?.create
  )
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytes
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ""
  for (const byte of bytes) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlToBuffer(value: string): ArrayBuffer {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64.length % 4 === 0 ? b64 : b64 + "=".repeat(4 - (b64.length % 4))
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function createOptions(userId: string, userName: string): PublicKeyCredentialCreationOptions {
  return {
    challenge: randomChallenge(),
    rp: { name: "Hotel Ava" },
    user: {
      id: new TextEncoder().encode(userId),
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
    timeout: 60_000,
    attestation: "none",
  }
}

function assertOptions(credentialId: string): PublicKeyCredentialRequestOptions {
  return {
    challenge: randomChallenge(),
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: [
      { type: "public-key", id: base64urlToBuffer(credentialId) },
    ],
  }
}

/**
 * Prompt the device biometric (fingerprint/face/Windows Hello) and resolve
 * when verified. Throws DOMException on cancel/timeout/unsupported hardware —
 * callers fall back to the regular "Sign in device" button.
 */
export async function verifyWithBiometric(
  userId: string,
  userName: string,
): Promise<BiometricResult> {
  if (!isBiometricSupported()) return "unsupported"

  const stored = localStorage.getItem(CRED_KEY)

  if (stored) {
    try {
      await navigator.credentials.get({ publicKey: assertOptions(stored) })
      return "ok"
    } catch (err) {
      // NotAllowedError = cancelled, timed out, or the credential vanished —
      // keep the stored id (so a cancel doesn't force re-registration) and
      // let the caller surface the fallback message.
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "UnknownError")) {
        throw err
      }
      // Anything else (bad id format, cleared profile) — re-register next time.
      localStorage.removeItem(CRED_KEY)
      throw err
    }
  }

  const created = (await navigator.credentials.create({
    publicKey: createOptions(userId, userName),
  })) as PublicKeyCredential | null
  if (!created) throw new DOMException("No credential created", "NotAllowedError")
  localStorage.setItem(CRED_KEY, bufferToBase64url(created.rawId))
  return "ok"
}
