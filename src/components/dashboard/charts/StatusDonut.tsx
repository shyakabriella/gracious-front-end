export type StatusValue = {
  label: string;
  value: number;
};

const colors = [
  "#626df1",
  "#929cf8",
  "#b9bdfb",
  "#39bbd4",
  "#f4a43b",
  "#d5d9fd",
];

export default function StatusDonut({
  items,
}: {
  items: StatusValue[];
}) {
  const values = items.filter(
    (item) => Number.isFinite(item.value) && item.value > 0
  );

  const total = values.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return (
      <div className="flex min-h-[250px] items-center justify-center text-center text-sm text-[#91a0b9]">
        No status distribution is available.
      </div>
    );
  }

  const segments = values.map((item, index) => {
    const previousTotal = values
      .slice(0, index)
      .reduce((sum, entry) => sum + entry.value, 0);

    const start = (previousTotal / total) * 100;
    const end = ((previousTotal + item.value) / total) * 100;

    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return (
    <div>
      <div className="mx-auto mt-5 flex h-[190px] w-[190px] items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${segments.join(", ")})`,
        }}
      >
        <div className="flex h-[130px] w-[130px] flex-col items-center justify-center rounded-full bg-white">
          <strong className="text-2xl font-bold text-[#263956] tabular-nums">
            {total.toLocaleString("en-RW")}
          </strong>
          <span className="mt-1 text-[11px] text-[#91a0b9]">
            Records
          </span>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-4">
        {values.map((item, index) => (
          <div key={item.label} className="flex min-w-0 gap-2">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: colors[index % colors.length],
              }}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold capitalize text-[#405575]">
                {item.label.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-[11px] text-[#91a0b9]">
                {((item.value / total) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
