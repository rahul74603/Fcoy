import axios from 'axios';
import { Trainee, CreateTraineeInput } from '../types/student.types';

const API_URL = 'http://localhost:3000/trainees';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

export const getTrainees = async (): Promise<Trainee[]> => {
  const response = await axios.get(API_URL, getAuthHeader());
  return response.data;
};

export const createTrainee = async (data: CreateTraineeInput): Promise<Trainee> => {
  const response = await axios.post(API_URL, data, getAuthHeader());
  return response.data;
};

export const deleteTrainee = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/${id}`, getAuthHeader());
};