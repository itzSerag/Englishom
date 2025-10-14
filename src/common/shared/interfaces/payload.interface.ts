export interface IPayload {
  sub: string;
  email: string;
  role: 'user';
  jti?: string;
}

export interface IAdminPayload {
  sub: string;
  email: string;
  role: 'admin';
}
