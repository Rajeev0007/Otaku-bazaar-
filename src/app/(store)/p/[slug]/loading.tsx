export default function Loading() {
  return (
    <div className="container-page pt-6">
      <div className="skeleton h-3 w-48 rounded" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <div className="skeleton aspect-[4/5] rounded-[var(--radius-card)]" />
        <div className="space-y-4">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-9 w-4/5 rounded-lg" />
          <div className="skeleton h-8 w-32 rounded-lg" />
          <div className="skeleton mt-8 h-11 w-full rounded-full" />
          <div className="skeleton h-13 w-full rounded-full" />
          <div className="skeleton h-13 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
