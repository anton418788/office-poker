export function WinnerCrown() {
  return (
    <span
      className="winner-crown"
      role="img"
      aria-label="Победитель прошлой раздачи"
      title="Победитель прошлой раздачи"
    >
      <svg viewBox="0 0 24 21" aria-hidden="true">
        <path
          d="M3 6 8 10 12 2 16 10 21 6 18 16H6Z"
          fill="#e5c66e"
          stroke="#84672e"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M6 18h12v2H6z" fill="#b58d3e" />
        <path
          d="m7 12 2 2h6l2-2"
          fill="none"
          stroke="#fff1ac"
          strokeWidth="1.2"
        />
      </svg>
    </span>
  );
}
