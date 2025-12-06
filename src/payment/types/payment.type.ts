import { Level_Name } from '../../common/shared/enums';

export interface Item {
  name: Level_Name;
  amount: number;
  description: string;
  quantity: number;
}

export interface BillingData {
  apartment: string;
  first_name: string;
  last_name: string;
  street: string;
  building: string;
  phone_number: string;
  city: string;
  country: string;
  email: string;
  floor: string;
  state: string;
}

export class PaymentRequest {
  amount: number;
  currency: string;
  payment_methods: number[];
  items: Item[];
  billing_data: BillingData;
}

export interface hmacValidationType {
  amount_cents: string;

  created_at: string;

  currency: string;

  error_occured: string;

  has_parent_transaction: string;

  id: string;

  integration_id: string;

  is_3d_secure: string;

  is_auth: string;

  is_capture: string;

  is_refunded: string;

  is_standalone_payment: string;

  is_voided: string;

  order_id: string;

  owner: string;

  pending: string;

  source_data_pan: string;

  source_data_sub_type: string;

  source_data_type: string;

  success: string;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum OrderAccessStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}
