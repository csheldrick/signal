export const MAX_LENGTH = 1000;

export function cloneSafeInterface<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}