import { ulid } from 'ulid';

export function newClickId(): string {
  return ulid();
}

export function newLinkId(): string {
  return ulid();
}
