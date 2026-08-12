import type { ReactNode } from "react";

type Series = {
	name: string;
	values: Array<string | number | null | undefined>;
};

type ChartTextAlternativeProps = {
	caption: string;
	categoryLabel: string;
	categories: Array<string | number>;
	series: Series[];
	emptyMessage?: string;
};

function formatCell(value: string | number | null | undefined): string {
	if (value === null || value === undefined || value === "") {
		return "No data";
	}

	return typeof value === "number" ? value.toLocaleString() : String(value);
}

//this is a screen-reader-only data table that carries the same information as a chart
export function ChartTextAlternative({
	caption,
	categoryLabel,
	categories,
	series,
	emptyMessage = "No data is available for this chart."
}: Readonly<ChartTextAlternativeProps>): ReactNode {
	if (categories.length === 0) {
		return <p className="sr-only">{`${caption}. ${emptyMessage}`}</p>;
	}

	return (
		<div className="sr-only">
			<table>
				<caption>{caption}</caption>
				<thead>
					<tr>
						<th scope="col">{categoryLabel}</th>
						{series.map((s) => (<th key={s.name} scope="col">{s.name}</th>))}
					</tr>
				</thead>
				<tbody>
					{categories.map((category, index) => (
						<tr key={`${category}-${index}`}>
							<th scope="row">{String(category)}</th>
							{series.map((s) => (
								<td key={s.name}>{formatCell(s.values[index])}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}