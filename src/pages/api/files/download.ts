// src/pages/api/download.js
export async function GET({ request }: { request: Request; }) {
	const url = new URL(request.url);
	const fileUrl = url.searchParams.get('url'); // or hardcode it
	const fileName = url.searchParams.get('filename');
	const response = await fetch(fileUrl ?? '');
	const blob = await response.blob();
	const arrayBuffer = await blob.arrayBuffer();

	return new Response(arrayBuffer, {
		headers: {
			'Content-Disposition': `attachment; filename="${fileName}"`,
			'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
		},
	});
}