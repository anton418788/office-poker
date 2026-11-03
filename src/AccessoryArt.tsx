import { memo, type ReactNode } from "react";

const gold = "#d6b66c",
  glass = "#d8e9df",
  amber = "#c98b3b";
const artwork: Record<string, ReactNode> = {
  whiskey: (
    <>
      <path fill={glass} fillOpacity=".3" d="M24 28h52l-6 51q-20 10-40 0Z" />
      <path fill={amber} d="m29 51 44-2-4 27q-19 8-38 0Z" />
      <path
        fill="#e5f4e5"
        fillOpacity=".75"
        d="m34 43 15-4 5 15-15 4Zm21-8 13 5-4 14-14-5Z"
      />
      <path
        d="m29 31 5 42M26 29q24 8 48 0"
        fill="none"
        stroke={glass}
        strokeWidth="3"
      />
    </>
  ),
  cognac: (
    <>
      <path
        d="M32 20h36q13 39-18 39T32 20Z"
        fill={glass}
        fillOpacity=".35"
        stroke={glass}
        strokeWidth="2"
      />
      <path d="M29 41h42q-1 17-21 17T29 41" fill={amber} />
      <path
        d="M50 59v22m-14 3q14-6 28 0"
        fill="none"
        stroke={glass}
        strokeWidth="3"
      />
      <path d="M34 27v12" stroke="white" strokeWidth="3" opacity=".7" />
    </>
  ),
  wine: (
    <>
      <path
        d="M32 12h36l4 25q1 20-22 23-23-3-22-23Z"
        fill={glass}
        fillOpacity=".3"
        stroke={glass}
        strokeWidth="2"
      />
      <path d="M29 34h42q3 20-21 24-24-4-21-24" fill="#8e3349" />
      <path
        d="M50 60v24m-16 3q16-6 32 0M35 18l-2 12"
        fill="none"
        stroke={glass}
        strokeWidth="3"
      />
    </>
  ),
  champagne: (
    <>
      <path
        d="M36 10h28l-2 37q-1 15-12 15T38 47Z"
        fill={glass}
        fillOpacity=".35"
        stroke={glass}
        strokeWidth="2"
      />
      <path d="m39 30 22-1-1 17q0 13-10 13T40 46Z" fill="#e3c276" />
      <path
        d="M50 62v22m-13 3q13-5 26 0"
        stroke={glass}
        strokeWidth="3"
        fill="none"
      />
      <g fill="#fff2c0">
        <circle cx="47" cy="47" r="2" />
        <circle cx="54" cy="37" r="1.5" />
        <circle cx="52" cy="54" r="1" />
      </g>
    </>
  ),
  espresso: (
    <>
      <ellipse
        cx="49"
        cy="72"
        rx="35"
        ry="13"
        fill="#ddd9c1"
        stroke="#b7b49c"
        strokeWidth="2"
      />
      <path
        d="M67 39q25-6 18 13-5 10-19 6"
        fill="none"
        stroke="#eee9d5"
        strokeWidth="7"
      />
      <path d="M24 37h46l-5 26q-17 13-36 0Z" fill="#f3eedc" />
      <ellipse
        cx="47"
        cy="37"
        rx="23"
        ry="9"
        fill="#653d29"
        stroke="#eee7cd"
        strokeWidth="4"
      />
      <path d="M36 36q9-5 20 0" fill="none" stroke="#c69a62" strokeWidth="3" />
    </>
  ),
  cigar: (
    <>
      <ellipse
        cx="50"
        cy="65"
        rx="38"
        ry="19"
        fill="#a5b6b0"
        stroke="#d5ded4"
        strokeWidth="3"
      />
      <ellipse cx="50" cy="64" rx="26" ry="11" fill="#53655d" />
      <g transform="rotate(-25 50 48)">
        <rect x="15" y="40" width="72" height="15" rx="7" fill="#935c39" />
        <path
          d="m25 42 5 11m9-11 5 11m9-11 5 11"
          stroke="#ba8050"
          strokeWidth="2"
        />
        <path d="M64 40h12v15H64Z" fill="#813747" stroke={gold} />
        <ellipse cx="85" cy="47" rx="3" ry="7" fill="#a6a59b" />
      </g>
    </>
  ),
  dice: (
    <>
      <g transform="rotate(-16 34 48)">
        <rect
          x="12"
          y="29"
          width="42"
          height="42"
          rx="8"
          fill="#f2e9cd"
          stroke="#c6b996"
          strokeWidth="2"
        />
        <g fill="#354c40">
          <circle cx="23" cy="40" r="3" />
          <circle cx="43" cy="60" r="3" />
          <circle cx="33" cy="50" r="3" />
        </g>
      </g>
      <g transform="rotate(16 65 57)">
        <rect
          x="45"
          y="39"
          width="40"
          height="40"
          rx="7"
          fill="#dfd5b9"
          stroke="#b5a788"
          strokeWidth="2"
        />
        <g fill="#354c40">
          <circle cx="55" cy="49" r="3" />
          <circle cx="75" cy="49" r="3" />
          <circle cx="55" cy="69" r="3" />
          <circle cx="75" cy="69" r="3" />
        </g>
      </g>
    </>
  ),
  pen: (
    <g transform="rotate(35 50 50)">
      <rect
        x="43"
        y="16"
        width="14"
        height="55"
        rx="6"
        fill="#28584c"
        stroke="#8f9b74"
        strokeWidth="2"
      />
      <path d="m44 71 6 17 6-17Zm-2-41h16v5H42Z" fill={gold} />
      <path d="M53 18v22" stroke={gold} strokeWidth="3" />
      <path d="M50 76v9" stroke="#755b35" />
    </g>
  ),
  phone: (
    <g transform="rotate(-16 50 50)">
      <rect
        x="26"
        y="9"
        width="48"
        height="82"
        rx="9"
        fill="#313e42"
        stroke="#8d999b"
        strokeWidth="2"
      />
      <rect x="30" y="14" width="22" height="24" rx="6" fill="#435056" />
      <g fill="#142229" stroke="#7c8c91" strokeWidth="2">
        <circle cx="36" cy="21" r="4" />
        <circle cx="45" cy="30" r="4" />
        <circle cx="36" cy="32" r="3" />
      </g>
      <path
        d="M51 49c-7-5-13 1-11 9 2 8 5 11 9 9 4-2 5 2 9-1 2-2 4-5 4-7-6-2-7-7-2-10-4-4-7-3-9 0Zm0-3q-1-7 7-9-1 8-7 9"
        fill="#a5afb1"
      />
    </g>
  ),
  joker: (
    <g transform="rotate(16 50 50)">
      <rect
        x="24"
        y="9"
        width="52"
        height="82"
        rx="5"
        fill="#eee4cb"
        stroke={gold}
        strokeWidth="2"
      />
      <text
        x="50"
        y="24"
        textAnchor="middle"
        fontSize="9"
        fill="#844657"
        fontFamily="serif"
      >
        JOKER
      </text>
      <path d="m32 52 1-20 15 12 15-14 6 25Z" fill="#804252" />
      <path d="m33 32 15 12 15-14-7 25H44Z" fill="#355f55" />
      <g fill={gold}>
        <circle cx="33" cy="32" r="3" />
        <circle cx="63" cy="30" r="3" />
        <circle cx="69" cy="55" r="3" />
      </g>
      <path
        d="M39 57q11 17 22 0"
        fill="none"
        stroke="#b99356"
        strokeWidth="3"
      />
      <path d="m44 78 6-7 6 7-6 7Z" fill="#804252" />
    </g>
  ),
  watch: (
    <>
      <path
        d="M64 25q31-18 22 9t-8 29"
        fill="none"
        stroke={gold}
        strokeWidth="3"
        strokeDasharray="3 2"
      />
      <rect x="43" y="15" width="14" height="9" rx="3" fill={gold} />
      <circle
        cx="50"
        cy="55"
        r="30"
        fill={gold}
        stroke="#9d7c46"
        strokeWidth="3"
      />
      <circle cx="50" cy="55" r="24" fill="#ece6ce" />
      <path
        d="M50 35v5m20 15h-5M50 75v-5m-20-15h5m15-15v15l12 7"
        fill="none"
        stroke="#44584a"
        strokeWidth="3"
      />
      <circle cx="50" cy="55" r="3" fill={gold} />
    </>
  ),
  lighter: (
    <g transform="rotate(-15 50 50)">
      <rect
        x="28"
        y="18"
        width="44"
        height="67"
        rx="7"
        fill="#c3a365"
        stroke="#ecd18c"
        strokeWidth="2"
      />
      <path
        d="M29 40h42M35 46v32m6-32v32m18-32v32m6-32v32"
        stroke="#987c45"
        strokeWidth="2"
      />
      <path d="m50 47-8 10q-6 9 6 8v6h4v-6q12 1 6-8Z" fill="#f1d590" />
    </g>
  ),
  notebook: (
    <g transform="rotate(12 50 50)">
      <rect x="24" y="15" width="55" height="72" rx="4" fill="#ccb276" />
      <rect
        x="20"
        y="11"
        width="55"
        height="72"
        rx="4"
        fill="#793d49"
        stroke="#b18069"
        strokeWidth="2"
      />
      <path d="M28 13v68m8-53h27m-27 5h19" stroke={gold} strokeWidth="2" />
      <path d="M59 82v11l5-4 5 4V82" fill="#d0b16c" />
      <path d="M70 15v64" stroke="#4a2933" strokeWidth="3" />
    </g>
  ),
  decanter: (
    <>
      <path
        d="M42 25h16v12l17 13v32q-25 11-50 0V50l17-13Z"
        fill={glass}
        fillOpacity=".4"
        stroke={glass}
        strokeWidth="2"
      />
      <path d="M28 57h44v23q-22 8-44 0Z" fill={amber} />
      <path
        d="M35 48v34m15-39v41m15-36v34"
        stroke="#f2e6b5"
        strokeWidth="2"
        opacity=".7"
      />
      <path d="M40 14h20v14H40Z" fill={gold} stroke="#f3d48e" strokeWidth="2" />
      <path d="m43 14 7-6 7 6" fill="#e7d8a8" />
    </>
  ),
  horseshoe: (
    <>
      <path
        d="M23 22h17v32q0 19 10 19t10-19V22h17v33q0 36-27 36T23 55Z"
        fill={gold}
        stroke="#f0d28c"
        strokeWidth="3"
      />
      <path
        d="M31 25v29q0 29 19 29t19-29V25"
        fill="none"
        stroke="#9e7a42"
        strokeWidth="2"
      />
      <g fill="#8a3748" stroke="#f5d7a0">
        <circle cx="31" cy="35" r="4" />
        <circle cx="31" cy="54" r="4" />
        <circle cx="69" cy="35" r="4" />
        <circle cx="69" cy="54" r="4" />
        <circle cx="50" cy="82" r="4" />
      </g>
    </>
  ),
};

export const AccessoryArt = memo(function AccessoryArt({
  itemId,
}: {
  itemId: string;
}) {
  return (
    <svg
      className="accessory-art"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {artwork[itemId.replace("accessory-", "")]}
    </svg>
  );
});
