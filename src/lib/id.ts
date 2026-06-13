import * as Crypto from 'expo-crypto';

/** Криптостойкий UUID v4 — работает в RN без полифиллов. */
export function uuid(): string {
  return Crypto.randomUUID();
}
