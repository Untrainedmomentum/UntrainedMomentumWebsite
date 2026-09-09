export async function onRequestGet(context) {
  if (!context.env.MEDIA) return new Response('Media storage is unavailable.', { status: 503 });
  const raw = context.params.path;
  const key = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
  const object = await context.env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}
