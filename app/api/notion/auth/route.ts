import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: process.env.NOTION_OAUTH_CLIENT_ID!,
    response_type: 'code',
    owner: 'user',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/notion/callback`,
    state,
  });

  const response = NextResponse.redirect(
    `https://api.notion.com/v1/oauth/authorize?${params}`,
  );

  response.cookies.set('notion_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  return response;
}
