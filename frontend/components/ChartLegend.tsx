type ChartLegendItem = {
    label: string;
    colour: string;
    variant?: "line" | "dashed" | "band" | "dot";
};

export function ChartLegend({ items }: { items: ChartLegendItem[] }) {
    return (
        <ul className="chart-legend">
            {items.map((item) => (
                <li key={item.label} className="chart-legend-item">
                    <span
                        className={`chart-legend-swatch chart-legend-swatch-${item.variant ?? "line"}`}
                        style={{ color: item.colour }}
                        aria-hidden="true"
                    />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}