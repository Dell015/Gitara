import { ScreenHead } from "../Shell";

/** Practice tools arrive in Phase 3. This screen says so plainly instead of showing fake buttons. */
export function Practice() {
  return (
    <>
      <ScreenHead title="Practice" tracked />
      <div className="empty">
        <p className="empty__title">Practice tools are on the way</p>
        <p className="empty__text">This is where you'll find them, in this order:</p>
        <ul className="plainlist">
          <li>Tuner, with tuning presets and reference tones</li>
          <li>Metronome with tap tempo and count-in</li>
          <li>Play-along: the chord chart moves with the song, with a click or a backing track</li>
          <li>Loop a section and a speed trainer</li>
          <li>Your practice queue</li>
        </ul>
      </div>
    </>
  );
}
