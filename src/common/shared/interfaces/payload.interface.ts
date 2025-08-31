export interface IPayload {
  sub: string;
  email: string;
  role : 'user';
}

export interface IAdminPayload {
  sub: string;
  email: string;
  role: 'admin';
}
