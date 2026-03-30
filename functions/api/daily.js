async function playerIndexForDate(secret, seed, count) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(seed));
  const bytes = new Uint8Array(signature);

  let value = 0;
  for (let index = 0; index < 8; index += 1) {
    value = (value * 256) + bytes[index];
  }

  return value % count;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const count = Number.parseInt(url.searchParams.get('count') || '0', 10);

  if (!Number.isInteger(count) || count <= 0) {
    return Response.json({ error: 'count must be a positive integer' }, { status: 400 });
  }

  const secret = context.env.DAILY_SECRET;
  if (!secret) {
    return Response.json({ error: 'DAILY_SECRET is not configured' }, { status: 500 });
  }

  const difficulty = url.searchParams.get('difficulty') === 'easy' ? 'easy' : 'hard';
  const date = new Date().toISOString().slice(0, 10);
  const seed = `${date}:${difficulty}`;
  const playerIndex = await playerIndexForDate(secret, seed, count);

  return Response.json({
    date,
    player_index: playerIndex,
    source: 'cloudflare-pages',
  });
}
