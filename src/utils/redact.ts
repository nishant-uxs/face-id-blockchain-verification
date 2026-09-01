/** Redact secrets from error messages before logging to terminal. */
export function redactSecrets(message: string): string {
  return message
    .replace(/0x[a-fA-F0-9]{64}/g, "0x[REDACTED_PRIVATE_KEY]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/api_key=[^&\s]+/gi, "api_key=[REDACTED]")
    .replace(/PINATA_JWT=\S+/g, "PINATA_JWT=[REDACTED]")
    .replace(/PRIVATE_KEY=\S+/g, "PRIVATE_KEY=[REDACTED]");
}
