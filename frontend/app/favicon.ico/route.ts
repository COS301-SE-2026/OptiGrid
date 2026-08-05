const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0B1120"/>
  <path d="M18 42V22h8v20h-8Zm13 0V14h8v28h-8Zm13 0V27h8v15h-8Z" fill="#8BB8E8"/>
</svg>`;

export function GET() {
	return new Response(faviconSvg, {
		headers: {
			"content-type": "image/svg+xml; charset=utf-8",
			"cache-control": "public, max-age=86400",
		},
	});
}
