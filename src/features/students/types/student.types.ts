export interface Trainee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  centerId: string;
  center?: {
    name: string;
  };
}

export interface CreateTraineeInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  centerId: string;
}