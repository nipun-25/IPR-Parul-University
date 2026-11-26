export function isDatabaseUnavailable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const errRecord = err as Record<string, unknown>;
  const code = typeof errRecord.code === 'string' ? errRecord.code : '';
  const msg = typeof errRecord.message === 'string' ? errRecord.message : '';

  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'EPIPE'].includes(code)) {
    return true;
  }
  if (code.startsWith('08') || code.startsWith('57P')) {
    return true;
  }
  if (/Connection terminated|timeout exceeded when trying to connect|client has already been released|could not connect to server/i.test(msg)) {
    return true;
  }
  return false;
}
