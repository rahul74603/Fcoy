import axios from 'axios';
import { LoginCredentials, AuthResponse } from '../types/auth.types';

// API ka URL
const API_URL = 'http://localhost:3000/auth';

export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await axios.post(`${API_URL}/login`, credentials);
  return response.data;
};
