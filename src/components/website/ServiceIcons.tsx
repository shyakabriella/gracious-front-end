const base = {
  width: 80,
  height: 80,
  viewBox: "0 0 80 80",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function NewHouseIcon() {
  return (
    <svg {...base}>
      <path d="M12 38L40 14l28 24" />
      <path d="M18 34v34M62 34v34" />
      <path d="M8 68h64" />
      <rect x="22" y="44" width="36" height="16" rx="2" />
      <text x="40" y="56" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" stroke="none">
        NEW
      </text>
      <circle cx="40" cy="28" r="4" />
    </svg>
  );
}

export function BuildingIcon() {
  return (
    <svg {...base}>
      <rect x="18" y="8" width="30" height="62" />
      <rect x="48" y="30" width="16" height="40" />
      <path d="M12 70h56" />
      <path d="M24 18h4M32 18h4M40 18h4M24 28h4M32 28h4M40 28h4M24 38h4M32 38h4M40 38h4M24 48h4M32 48h4M40 48h4" />
      <path d="M53 38h3M58 38h3M53 48h3M58 48h3" />
      <path d="M26 70V60h8v10" />
    </svg>
  );
}

export function AgentIcon() {
  return (
    <svg {...base}>
      <circle cx="46" cy="24" r="10" />
      <path d="M28 66c0-12 8-20 18-20s18 8 18 20" />
      <path d="M46 46l-5 8 5 12 5-12-5-8z" />
      <path d="M8 38l14-14 14 14" />
      <path d="M12 36v22h12" />
      <rect x="18" y="38" width="8" height="8" />
    </svg>
  );
}

export function HouseForSaleIcon() {
  return (
    <svg {...base}>
      <rect x="12" y="30" width="44" height="38" />
      <path d="M56 40h12v28H56" />
      <path d="M12 30l8-12h28l8 12" />
      <path d="M40 18V8l28 6v6" />
      <rect x="20" y="40" width="10" height="10" />
      <rect x="20" y="56" width="16" height="12" />
      <rect x="42" y="56" width="10" height="12" />
      <path d="M8 68h64" />
    </svg>
  );
}
