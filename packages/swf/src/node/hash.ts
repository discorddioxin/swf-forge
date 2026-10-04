/** Content hash for the Node entry point (`CMP` §3's stable `MovieModel.id`). */
import { createHash } from 'node:crypto';

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
