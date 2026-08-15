import type { ReactNode } from "react";
import { ChartTextAlternative } from "./ChartTextAlternative";

type Series = {
	name: string;
	values: Array<string | number | null | undefined>;
};

type AccessibleChartProps = {
	caption: string;
	categoryLabel: string;
	categories: Array<string | number>;
	series: Series[];
	emptyMessage?: string;
	// This is the visual chart which is hidden from assistive technology
	children: ReactNode;
};

// this functon pairs a visual chart with its WCAG 1.1.1 text alternative in one place
export function AccessibleChart({caption, categoryLabel, categories, series, emptyMessage, children}: Readonly<AccessibleChartProps>): ReactNode {
	return (
		<>
			<ChartTextAlternative
				caption={caption}
				categoryLabel={categoryLabel}
				categories={categories}
				series={series}
				emptyMessage={emptyMessage}
			/>
			<div aria-hidden="true">{children}</div>
		</>
	);
}