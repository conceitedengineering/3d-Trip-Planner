export interface Env {
  ASSETS: Fetcher;
  APP_VERSION?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ status: 'ok', now: new Date().toISOString() });
    }

    if (url.pathname === '/api/version') {
      return json({ version: env.APP_VERSION ?? 'dev' });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const response = new Response(assetResponse.body, assetResponse);

    if (url.pathname.endsWith('.min.json')) {
      response.headers.set('cache-control', 'public, max-age=604800, stale-while-revalidate=86400');
    }

    if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
      response.headers.set('cache-control', 'public, max-age=60');
    }

    return response;
  },
};
