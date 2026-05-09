import { getBackendBaseUrl } from '../../../../lib/backend-url';

export async function POST(request) {
  try {
    const body = await request.json();
    const backendUrl = getBackendBaseUrl();
    const apiUrl = `${backendUrl}/api/auth/login`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    return Response.json(data, { status: 200 });
  } catch (error) {
    return Response.json({ message: 'Failed to login', error: error.message }, { status: 500 });
  }
}
