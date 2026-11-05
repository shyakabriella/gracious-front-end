export type DashboardMetric = {
  label: string;
  value: number;
};

export default function MetricBars({
  metrics,
}: {
  metrics: DashboardMetric[];
}) {
  if (!metrics.length) {
    return (
      <div className="flex min-h-[245px] items-center justify-center rounded-lg border border-dashed border-[#e5e8f3] px-5 text-center text-sm text-[#91a0b9]">
        No comparable activity figures are available.
      </div>
    );
  }

  const visible = metrics.slice(0, 7);
  const highest = Math.max(...visible.map((item) => item.value), 1);

  return (
    <div>
      <div className="flex h-[245px] items-end justify-around gap-3 border-b border-[#dfe5f0] bg-[repeating-linear-gradient(to_top,transparent_0px,transparent_59px,#edf0f7_60px)] px-4">
        {visible.map((item) => (
          <div
            key={item.label}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${item.label}: ${item.value}`}
          >
            <div
              className="mx-auto w-full max-w-7 rounded-t-md bg-[#626df1]"
              style={{
                height: `${Math.max(
                  2,
                  (item.value / highest) * 85
                )}%`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-around gap-2">
        {visible.map((item) => (
          <div key={item.label} className="min-w-0 flex-1 text-center">
            <p className="truncate text-[10px] text-[#8194b3]" title={item.label}>
              {item.label}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#263956] tabular-nums">
              {item.value.toLocaleString("en-RW")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
