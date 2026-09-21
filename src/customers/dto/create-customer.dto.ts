export interface CreateCustomerDto {
  userId: string;
  fullName: string;
  phone: string;
  dateOfBirth: Date | null;
}
