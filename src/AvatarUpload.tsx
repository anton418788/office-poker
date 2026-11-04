import { useRef, useState } from "react";
import { AVATAR_TYPES, MAX_AVATAR_BYTES } from "../shared/avatar";
import { AvatarContent } from "./AvatarContent";
export function AvatarUpload({
  name,
  url,
  busy,
  onUpload,
  onRemove,
}: {
  name: string;
  url?: string | null;
  busy: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <div className="avatar-editor">
      <button
        className="profile-portrait avatar-upload"
        aria-label="Изменить аватарку"
        title="Изменить аватарку"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <AvatarContent name={name} url={url} />
        <span className="avatar-upload-overlay" aria-hidden="true">
          {busy ? "…" : "✎"}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        aria-label="Файл аватарки"
        hidden
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setNotice("");
          setError("");
          if (file.size > MAX_AVATAR_BYTES) {
            setError("Максимум 5 МБ. Выберите фото поменьше.");
            return;
          }
          if (file.type && !AVATAR_TYPES.includes(file.type)) {
            setError("Подойдут JPG, PNG или WebP.");
            return;
          }
          if (await onUpload(file)) setNotice("Аватарка обновлена");
        }}
      />
      {url && (
        <button
          className="avatar-remove"
          disabled={busy}
          onClick={async () => {
            setError("");
            setNotice("");
            if (await onRemove()) setNotice("Аватарка удалена");
          }}
        >
          Убрать фото
        </button>
      )}
      <small>JPG, PNG, WebP · до 5 МБ</small>
      <small>Автообрезка по центру</small>
      {error && (
        <span className="avatar-editor-error" role="alert">
          {error}
        </span>
      )}
      {notice && (
        <span className="avatar-editor-notice" role="status">
          {notice}
        </span>
      )}
    </div>
  );
}
