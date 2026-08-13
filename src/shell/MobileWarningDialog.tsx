// Dismissible warning shown when a `mobileUnavailable` exercise is opened on a
// mobile-sized screen (see TopicHost / useIsMobile). The exercise stays usable —
// this only cautions that finger note-placement + stave scaling are unreliable
// on touch. Dismiss via the button or by tapping the backdrop.
export function MobileWarningDialog({ title, onDismiss }: { title: string; onDismiss: () => void }) {
  return (
    <div className="mobile-warning-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="mobile-warning-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-warning-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mobile-warning-title" className="mobile-warning-title">
          {title}
        </h2>
        <p className="mobile-warning-msg">
          Using this exercise on mobile is not recommended due to size issues and the accuracy of touch
          input. This feature is best used on desktop.
        </p>
        <button type="button" className="mobile-warning-btn" onClick={onDismiss} autoFocus>
          Continue anyway
        </button>
      </div>
    </div>
  );
}
