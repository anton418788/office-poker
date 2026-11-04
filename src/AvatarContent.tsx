import { useState, type ReactNode } from "react";
export function AvatarContent({
  name,
  url,
  fallback,
}: {
  name: string;
  url?: string | null;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return url && failed !== url ? (
    <img
      className="avatar-image"
      src={url}
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setFailed(url)}
    />
  ) : (
    <>{fallback ?? name.slice(0, 1).toUpperCase()}</>
  );
}
