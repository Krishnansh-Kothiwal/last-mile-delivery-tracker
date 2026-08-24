const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    let errorDetail: any = null;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorDetail = errorData.detail;
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof errorData.detail === 'object' && errorData.detail.message) {
          errorMessage = errorData.detail.message;
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      }
    } catch {
      // fallback to status text
    }
    const err: any = new Error(errorMessage);
    if (errorDetail) {
      err.detail = errorDetail;
    }
    throw err;
  }

  return response.json();
}
