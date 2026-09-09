import { json, errorMessage } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  try {
    const user = await requireUser(context);
    if (!user) return json({ error: 'Not authorized.' }, 401);
    if (!context.env.MEDIA) return json({ error: 'Image storage is not configured yet.' }, 503);

    const url = new URL(context.request.url);
    const slug = String(url.searchParams.get('site') || '').trim();
    if (!slug) return json({ error: 'Site is required.' }, 400);

    const site = await context.env.DB.prepare('SELECT id, owner_user_id FROM sites WHERE slug = ? LIMIT 1').bind(slug).first();
    if (!site) return json({ error: 'Site not found.' }, 404);
    if (user.role !== 'admin' && site.owner_user_id !== user.id) return json({ error: 'Not authorized.' }, 403);

    const result = await context.env.MEDIA.list({ prefix: `${slug}/`, limit: 100 });
    const items = (result.objects || [])
      .map((object) => ({
        key: object.key,
        url: `/api/media/${object.key}`,
        size: Number(object.size || 0),
        uploaded: object.uploaded instanceof Date ? object.uploaded.toISOString() : (object.uploaded || null)
      }))
      .sort((a, b) => String(b.uploaded || b.key).localeCompare(String(a.uploaded || a.key)));

    return json({ ok: true, items, truncated: Boolean(result.truncated) });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
