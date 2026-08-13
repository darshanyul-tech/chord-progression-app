// Shown in place of an exercise flagged `mobileUnavailable` when the viewport is
// mobile-sized (see TopicHost / useIsMobile). These exercises need finger-precise
// note placement on a stave, which is unreliable on touch and too cramped to
// scale down.
export function MobileUnavailableNotice({ title }: { title: string }) {
  return (
    <section className="card mobile-unavailable">
      <h2>{title}</h2>
      <p className="mobile-unavailable-msg">
        This exercise isn’t available on mobile due to scaling and functionality issues. Please open it on a
        larger screen (tablet or desktop).
      </p>
    </section>
  );
}
