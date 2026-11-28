export type Tab = "table" | "log" | "players";

const TABS: { id: Tab; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "log", label: "Log" },
  { id: "players", label: "Players" },
];

/** The bottom bar on a phone (#59): three views of the one table. Hidden on wider screens. */
export function Nav(props: { tab: Tab; onTab: (tab: Tab) => void; onMap: () => void }) {
  return (
    <nav className="table-nav" aria-label="Table views">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={props.tab === t.id ? "page" : undefined}
          onClick={() => props.onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
      <button type="button" aria-label="Neighborhoods" onClick={props.onMap}>
        Map
      </button>
    </nav>
  );
}
