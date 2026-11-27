import { useEffect, useState } from "react";
import { createRoom } from "./connection";
import { RoomPage } from "./RoomPage";

/** Hash routes: `#/` is the home page, `#/room/<id>` a room. A room link is all players need. */
const roomFromHash = () => /^#\/room\/([\w-]+)$/.exec(location.hash)?.[1] ?? null;

export function App() {
  const [room, setRoom] = useState(roomFromHash);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onHash = () => setRoom(roomFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (room) return <RoomPage room={room} />;
  return (
    <main className="page">
      <h1>Bull City Blocks</h1>
      <p>Collect Durham's districts, charge rent, and finish three complete districts to win.</p>
      <button
        type="button"
        onClick={() =>
          createRoom().then(
            (id) => {
              location.hash = `#/room/${id}`;
            },
            (e: Error) => setError(e.message),
          )
        }
      >
        Create a room
      </button>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
