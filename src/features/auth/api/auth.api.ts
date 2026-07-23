export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  [key: string]: unknown;
}

// Legacy REST login helper. Main app uses Firebase LoginScreen,
// but this keeps the old LoginForm compiling without axios.
const API_URL = 'http://localhost:3000/auth';

export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  return response.json() as Promise<AuthResponse>;
};
