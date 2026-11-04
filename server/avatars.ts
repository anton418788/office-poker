import sharp from "sharp";
import { MAX_AVATAR_BYTES } from "../shared/avatar.js";
export async function prepareAvatar(input: Buffer) {
  if (!input.length)
    throw Object.assign(Error("Выберите изображение для аватарки"), {
      status: 400,
    });
  if (input.length > MAX_AVATAR_BYTES)
    throw Object.assign(Error("Максимальный размер аватарки — 5 МБ"), {
      status: 413,
    });
  const jpeg = input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const png = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    input.toString("ascii", 0, 4) === "RIFF" &&
    input.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp)
    throw Object.assign(Error("Выберите изображение JPG, PNG или WebP"), {
      status: 415,
    });
  try {
    return await sharp(input, {
      limitInputPixels: 40_000_000,
      failOn: "warning",
    })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw Object.assign(
      Error(
        "Не удалось прочитать изображение. Выберите другое фото JPG, PNG или WebP размером до 5 МБ и разрешением до 40 мегапикселей.",
      ),
      { status: 415 },
    );
  }
}
