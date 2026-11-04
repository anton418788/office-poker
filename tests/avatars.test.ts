import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareAvatar } from "../server/avatars.js";
import { MAX_AVATAR_BYTES } from "../shared/avatar.js";
test("Автокадрирование берёт центр широкого фото и сохраняет квадрат WebP 512×512 без метаданных", async () => {
  const pixels = Buffer.alloc(900 * 300 * 3);
  for (let y = 0; y < 300; y++)
    for (let x = 0; x < 900; x++)
      pixels[(y * 900 + x) * 3 + (x < 300 ? 0 : x < 600 ? 1 : 2)] = 255;
  const input = await sharp(pixels, {
    raw: { width: 900, height: 300, channels: 3 },
  })
    .png()
    .toBuffer();
  const image = await prepareAvatar(input),
    meta = await sharp(image).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.exif, undefined);
  const raw = await sharp(image).removeAlpha().raw().toBuffer();
  for (const index of [
    (16 * 512 + 16) * 3,
    (256 * 512 + 256) * 3,
    (496 * 512 + 496) * 3,
  ]) {
    assert.ok(raw[index] < 8);
    assert.ok(raw[index + 1] > 247);
    assert.ok(raw[index + 2] < 8);
  }
});
test("Ориентация камеры исправляется до сохранения", async () => {
  const pixels = Buffer.alloc(64 * 64 * 3);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++)
      pixels[(y * 64 + x) * 3 + (x < 32 ? 0 : 2)] = 255;
  const input = await sharp(pixels, {
    raw: { width: 64, height: 64, channels: 3 },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const output = await prepareAvatar(input),
    raw = await sharp(output).raw().toBuffer();
  const top = (16 * 512 + 256) * 3,
    bottom = (496 * 512 + 256) * 3;
  assert.ok(raw[top] > 230 && raw[top + 2] < 25);
  assert.ok(raw[bottom + 2] > 230 && raw[bottom] < 25);
  assert.equal((await sharp(output).metadata()).orientation, undefined);
});
test("Отвергаются пустые, повреждённые, неподдерживаемые и слишком большие файлы", async () => {
  await assert.rejects(prepareAvatar(Buffer.alloc(0)), { status: 400 });
  await assert.rejects(
    prepareAvatar(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    { status: 415 },
  );
  await assert.rejects(
    prepareAvatar(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0])),
    { status: 415 },
  );
  await assert.rejects(prepareAvatar(Buffer.alloc(MAX_AVATAR_BYTES + 1)), {
    status: 413,
  });
});
