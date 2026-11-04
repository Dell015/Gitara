import type { ReactNode } from "react";

/** One stroke weight (1.75), round caps, 24px grid. Drawn for Gitara; no icon-font glyphs. */
function Svg({ children, filled }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconSongs = () => (
  <Svg>
    <path d="M6 5v14M10.5 8v11M15 4v15" />
    <path d="M19 9l2 9.5" />
  </Svg>
);
export const IconPlaylists = () => (
  <Svg>
    <path d="M4 7h11M4 12h11M4 17h6" />
    <path d="M16 15.5v4.5l4-2.25z" />
  </Svg>
);
export const IconJam = () => (
  <Svg>
    <path d="M4 10v4M8 6.5v11M12 9v6M16 4v16M20 9.5v5" />
  </Svg>
);
export const IconTuner = () => (
  <Svg>
    <path d="M8.5 3v7.5a3.5 3.5 0 0 0 7 0V3M12 14v7" />
  </Svg>
);
export const IconListen = () => (
  <Svg>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </Svg>
);
export const IconPlay = () => (
  <Svg filled>
    <path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" />
  </Svg>
);
export const IconPause = () => (
  <Svg filled>
    <rect x="6.5" y="5" width="3.8" height="14" rx="1" />
    <rect x="13.7" y="5" width="3.8" height="14" rx="1" />
  </Svg>
);
export const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconDown = () => (
  <Svg>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);

export const IconHome = () => (
  <Svg>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconSearch = () => (
  <Svg>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </Svg>
);
/** Practice: a metronome. */
export const IconPractice = () => (
  <Svg>
    <path d="M9.2 3.5h5.6L19 20H5z" />
    <path d="M12 16l4.5-8.5" />
    <path d="M7.5 15.5h9" />
  </Svg>
);
export const IconHeart = ({ filled }: { filled?: boolean }) =>
  filled ? (
    <Svg filled>
      <path d="M12 20.3 4.4 12.9A4.7 4.7 0 0 1 11 6.2l1 1 1-1a4.7 4.7 0 0 1 6.6 6.7z" />
    </Svg>
  ) : (
    <Svg>
      <path d="M12 19.5 4.9 12.6A4.4 4.4 0 0 1 11.1 6.4L12 7.3l.9-.9a4.4 4.4 0 0 1 6.2 6.2z" />
    </Svg>
  );
export const IconMore = () => (
  <Svg filled>
    <circle cx="5.5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18.5" cy="12" r="1.7" />
  </Svg>
);
export const IconBack = () => (
  <Svg>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);
export const IconGrid = () => (
  <Svg>
    <rect x="4.5" y="4.5" width="6" height="6" rx="1.2" />
    <rect x="13.5" y="4.5" width="6" height="6" rx="1.2" />
    <rect x="4.5" y="13.5" width="6" height="6" rx="1.2" />
    <rect x="13.5" y="13.5" width="6" height="6" rx="1.2" />
  </Svg>
);
export const IconList = () => (
  <Svg>
    <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20" />
    <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.6" />
  </Svg>
);
export const IconPin = () => (
  <Svg>
    <path d="M9 4h6l-1 5.5 3.5 3.5h-11L10 9.5z" />
    <path d="M12 13v7" />
  </Svg>
);
export const IconSort = () => (
  <Svg>
    <path d="M7 5v14M4 16l3 3 3-3" />
    <path d="M17 19V5M14 8l3-3 3 3" />
  </Svg>
);
export const IconCheck = () => (
  <Svg>
    <path d="M5 12.5 10 17.5 19 7" />
  </Svg>
);
export const IconExternal = () => (
  <Svg>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10" />
  </Svg>
);
export const IconDrag = () => (
  <Svg>
    <path d="M5 9h14M5 15h14" />
  </Svg>
);
export const IconClose = () => (
  <Svg>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Svg>
);
export const IconPerson = () => (
  <Svg>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
  </Svg>
);
export const IconGroup = () => (
  <Svg>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19c.9-2.9 3-4.3 5.5-4.3s4.6 1.4 5.5 4.3" />
    <path d="M15.5 6.4a3 3 0 0 1 0 5.2M17.5 14.9c1.6.6 2.7 1.9 3.2 4.1" />
  </Svg>
);
export const IconLock = () => (
  <Svg>
    <rect x="5.5" y="10.5" width="13" height="9" rx="1.8" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);
export const IconGlobe = () => (
  <Svg>
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12h16M12 4c2.3 2.4 3.4 5 3.4 8s-1.1 5.6-3.4 8c-2.3-2.4-3.4-5-3.4-8S9.7 6.4 12 4z" />
  </Svg>
);
export const IconLink = () => (
  <Svg>
    <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
  </Svg>
);
export const IconArrow = () => (
  <Svg>
    <path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5" />
  </Svg>
);
export const IconUp = ({ filled }: { filled?: boolean }) =>
  filled ? (
    <Svg filled>
      <path d="M12 4.5 19 13h-4.2v6.5H9.2V13H5z" />
    </Svg>
  ) : (
    <Svg>
      <path d="M12 4.5 19 13h-4.2v6.5H9.2V13H5z" />
    </Svg>
  );
export const IconStar = ({ filled }: { filled?: boolean }) =>
  filled ? (
    <Svg filled>
      <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
    </Svg>
  ) : (
    <Svg>
      <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
    </Svg>
  );
