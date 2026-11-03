import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const tokenHash = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");
export async function passwordHash(password: unknown) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw Error("Пароль: от 8 до 128 символов");
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password: unknown, stored: string) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [salt, hex] = stored.split(":");
  const key = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}
export function loginName(value: unknown) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_.-]{3,32}$/.test(value))
    throw Error(
      "Логин: 3–32 символа, латинские буквы, цифры, точка, дефис или _",
    );
  return value.toLowerCase();
}
export function displayName(value: unknown) {
  if (
    typeof value !== "string" ||
    value.trim().length < 2 ||
    value.trim().length > 24
  )
    throw Error("Имя: от 2 до 24 символов");
  return value.trim();
}
export function chipsAmount(value: unknown) {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 10_000_000
  )
    throw Error("Баланс: целое число от 0 до 10 000 000");
  return value as number;
}
