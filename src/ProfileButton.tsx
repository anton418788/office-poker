import { WinnerCrown } from "./WinnerCrown";
export function ProfileButton({
  name,
  count,
  onClick,
  winner = false,
}: {
  name?: string;
  count: number;
  onClick: () => void;
  winner?: boolean;
}) {
  return (
    <button
      className="profile-access"
      onClick={onClick}
      aria-label={count ? `Профиль, неоткрытых подарков: ${count}` : "Профиль"}
      title="Мой профиль"
    >
      <span className="profile-access-avatar" aria-hidden="true">
        {name?.slice(0, 1).toUpperCase() || "♙"}
        {winner && <WinnerCrown />}
        {count > 0 && <span className="gift-count">{count}</span>}
      </span>
      <span className="profile-access-label">Профиль</span>
    </button>
  );
}
