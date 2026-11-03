import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, type ReactNode } from "react";
import { startSession } from "../data/auth";
import { db } from "../data/local-db";
import { startSync } from "../data/sync";
import { ItemRow, Mark } from "../ui/bits";
import { IconHome, IconPerson, IconPin, IconPlus, IconPractice, IconSearch, IconSongs } from "../ui/icons";
import { plural, usePlaylistCounts } from "./hooks";
import { NavProvider, useNav, type Route, type Tab } from "./nav";
import { OverlayHost } from "./OverlayHost";
import { OverlayProvider, useOverlays } from "./overlays";
import { AddSong } from "./screens/AddSong";
import { ArtistScreen } from "./screens/Artist";
import { Browse } from "./screens/Browse";
import { Collection } from "./screens/Collection";
import { Home } from "./screens/Home";
import { Library } from "./screens/Library";
import { PlaylistScreen } from "./screens/Playlist";
import { Practice } from "./screens/Practice";
import { Search } from "./screens/Search";
import { SongScreen } from "./screens/Song";

export function App() {
  useEffect(() => {
    void startSession().then(() => startSync());
  }, []);
  return (
    <NavProvider>
      <OverlayProvider>
        <Frame />
      </OverlayProvider>
    </NavProvider>
  );
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", icon: <IconHome /> },
  { id: "search", label: "Search", icon: <IconSearch /> },
  { id: "library", label: "Library", icon: <IconSongs /> },
  { id: "practice", label: "Practice", icon: <IconPractice /> },
];

function Frame() {
  const nav = useNav();
  const { open } = useOverlays();
  const key = `${nav.tab}:${nav.depth}:${JSON.stringify(nav.route)}`;
  return (
    <div className="app">
      <nav className="tabs glass" aria-label="Main">
        <div className="tabs__brand" aria-hidden="true">
          Gitara
        </div>
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={nav.tab === t.id ? "page" : undefined} onClick={() => nav.switchTab(t.id)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <button className="tab" onClick={() => open({ kind: "create" })}>
          <IconPlus />
          <span>Create</span>
        </button>
        <SidebarLibrary />
      </nav>
      <main className="page" key={key} data-depth={nav.depth}>
        <Screen route={nav.route} />
      </main>
      <OverlayHost />
      <ToastView />
    </div>
  );
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "home":
      return <Home />;
    case "search":
      return <Search />;
    case "library":
      return <Library />;
    case "practice":
      return <Practice />;
    case "song":
      return <SongScreen id={route.id} />;
    case "artist":
      return <ArtistScreen artist={route.artist} />;
    case "playlist":
      return <PlaylistScreen id={route.id} />;
    case "collection":
      return <Collection kind={route.kind} />;
    case "browse":
      return <Browse genre={route.genre} />;
    case "addSong":
      return <AddSong title={route.title} artist={route.artist} editId={route.editId} />;
  }
}

/** Header for the main tabs: your avatar (profile and settings) on the left, like Spotify. */
export function ScreenHead({ title, tracked, right }: { title: string; tracked?: boolean; right?: ReactNode }) {
  const { open } = useOverlays();
  return (
    <header className="screenhead">
      <button className="avatar" aria-label="Account and settings" onClick={() => open({ kind: "account" })}>
        <IconPerson />
      </button>
      <h1 className={tracked ? "screenhead__title screenhead__title--tracked" : "screenhead__title"}>{title}</h1>
      <div className="screenhead__right">{right}</div>
    </header>
  );
}

/** Desktop only: your Library down the left side, like Spotify desktop. */
function SidebarLibrary() {
  const nav = useNav();
  const counts = usePlaylistCounts();
  const playlists = useLiveQuery(() => db.playlists.toArray());
  const liked = useLiveQuery(() => db.library.count());
  const sorted = [...(playlists ?? [])].sort((a, b) => Number(!!b.pinnedAt) - Number(!!a.pinnedAt) || b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="sidelib">
      <p className="sidelib__label">Your Library</p>
      <ItemRow title="Liked songs" sub={plural(liked ?? 0, "song")} lead={<Mark kind="liked" />} onClick={() => nav.goTo("library", { name: "collection", kind: "liked" })} />
      {sorted.map((p) => (
        <ItemRow
          key={p.id}
          title={p.name}
          sub={`Playlist · ${plural(counts?.get(p.id) ?? 0, "song")}`}
          lead={<Mark kind="playlist" />}
          trail={p.pinnedAt ? <span className="pin"><IconPin /></span> : undefined}
          onClick={() => nav.goTo("library", { name: "playlist", id: p.id })}
        />
      ))}
    </div>
  );
}

function ToastView() {
  const { toast, hideToast } = useOverlays();
  return (
    <div className="toast-slot" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              className="toast__action"
              onClick={() => {
                toast.action!.run();
                hideToast();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
