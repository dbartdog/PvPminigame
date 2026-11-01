import { randomInt } from 'node:crypto';

/** Leaves out 0/O and 1/I/L so a code read aloud over voice chat can't be misheard. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return code;
}
