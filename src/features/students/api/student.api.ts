import { Trainee, CreateTraineeInput } from '../types/student.types';

const API_URL = 'http://localhost:3000/trainees';

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const getTrainees = async (): Promise<Trainee[]> => {
  const response = await fetch(API_URL, { headers: getAuthHeaders() });
  return parseJson<Trainee[]>(response);
};

export const createTrainee = async (data: CreateTraineeInput): Promise<Trainee> => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return parseJson<Trainee>(response);
};

export const deleteTrainee = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Delete failed: ${response.status}`);
  }
};
