const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

const credentials = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server credentials are not configured');
  return { url, key };
};

const api = async (url: string, key: string, path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const result = await fetch(`${url}${path}`, { ...init, headers });
  const text = await result.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!result.ok) throw new Error(data?.message ?? data?.msg ?? `Supabase API error ${result.status}`);
  return data;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  try {
    const { url, key } = credentials();
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return response({ error: 'Authentication required' }, 401);
    const actor = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!actor.ok) return response({ error: 'Invalid session' }, 401);
    const actorUser = await actor.json();
    const actorProfiles = await api(url, key, `/rest/v1/profiles?select=role,active&id=eq.${actorUser.id}`);
    if (actorProfiles[0]?.role !== 'supervisor' || !actorProfiles[0]?.active) return response({ error: 'Only an active supervisor can manage users' }, 403);
    const body = await request.json();
    if (body.action === 'list') {
      const [profiles, users] = await Promise.all([
        api(url, key, '/rest/v1/profiles?select=id,full_name,role,phone,active,created_at&order=full_name.asc'),
        api(url, key, '/auth/v1/admin/users?page=1&per_page=1000')
      ]);
      const emails = new Map((users.users ?? []).map((user: any) => [user.id, user.email ?? '']));
      return response({ users: profiles.map((profile: any) => ({ ...profile, email: emails.get(profile.id) ?? '' })) });
    }
    if (body.action === 'create') {
      const email = body.email?.trim().toLowerCase();
      const password = body.password ?? '';
      const fullName = body.fullName?.trim();
      const role = body.role;
      if (!email || !fullName || !['supervisor', 'coordinator', 'technician'].includes(role ?? '') || password.length < 8) return response({ error: 'Nombre, correo, rol y una contraseña de al menos 8 caracteres son obligatorios' }, 400);
      const created = await api(url, key, '/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }) });
      try {
        await api(url, key, `/rest/v1/profiles?id=eq.${created.id}`, { method: 'PATCH', body: JSON.stringify({ full_name: fullName, role, active: true }) });
      } catch (error) {
        await api(url, key, `/auth/v1/admin/users/${created.id}`, { method: 'DELETE' }).catch(() => undefined);
        throw error;
      }
      return response({ id: created.id, email });
    }
    if (body.action === 'set-active') {
      if (!body.userId || body.userId === actorUser.id || typeof body.active !== 'boolean') return response({ error: 'No puedes desactivar tu propia cuenta' }, 400);
      await api(url, key, `/rest/v1/profiles?id=eq.${body.userId}`, { method: 'PATCH', body: JSON.stringify({ active: body.active }) });
      await api(url, key, `/auth/v1/admin/users/${body.userId}`, { method: 'PUT', body: JSON.stringify({ ban_duration: body.active ? 'none' : '876000h' }) });
      return response({ id: body.userId, active: body.active });
    }
    return response({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('admin-users failed', error);
    return response({ error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
});
