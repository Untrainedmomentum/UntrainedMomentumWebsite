import { json, errorMessage } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

export async function onRequestPost(context) {
  try {
    const user = await requireUser(context);
    if (!user) return json({ error: 'Not authorized.' }, 401);
    if (!context.env.MEDIA) return json({ error: 'Image storage is not configured yet.' }, 503);
    const form = await context.request.formData();
    const file = form.get('file');
    const slug = String(form.get('site') || '').trim();
    if (!(file instanceof File) || !slug) return json({ error: 'Image and site are required.' }, 400);
    if (!ALLOWED.has(file.type)) return json({ error: 'Use JPG, PNG, WebP, GIF, or AVIF images.' }, 415);
    if (file.size > 8 * 1024 * 1024) return json({ error: 'Images must be 8 MB or smaller.' }, 413);

    const site = await context.env.DB.prepare('SELECT id, owner_user_id FROM sites WHERE slug = ? LIMIT 1').bind(slug).first();
    if (!site) return json({ error: 'Site not found.' }, 404);
    if (user.role !== 'admin' && site.owner_user_id !== user.id) return json({ error: 'Not authorized.' }, 403);

    const date = new Date().toISOString().slice(0, 10);
    const key = `${slug}/${date}/${crypto.randomUUID()}.${EXT[file.type]}`;
    await context.env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { uploadedBy: user.id, originalName: String(file.name || '').slice(0, 200) }
    });
    return json({ ok: true, url: `/api/media/${key}`, key });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
