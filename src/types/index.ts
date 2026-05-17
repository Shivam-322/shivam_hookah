export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  color?: string | null;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderPayment {
  method: 'phonepe';
  merchantTransactionId: string;
  phonePeTransactionId: string;
  status: 'paid' | 'pending' | 'failed';
  /** Only present on pending orders */
  expectedAmount?: number;
  expectedAmountPaise?: number;
  /** Only present on failed orders */
  failureCode?: string;
  failureMessage?: string;
  /** Set when gateway is detected */
  gateway?: string;
  /** UPI Manual specific fields */
  whatsappSent?: boolean;
  confirmedAt?: any;
  confirmedBy?: string | null;
}

export interface OrderShiprocket {
  orderId: string | null;
  shipmentId: string | null;
  awb: string | null;
  courierName: string | null;
  courierCode: string | null;
  labelUrl: string | null;
  manifestUrl: string | null;
  status: string | null;
  statusLabel: string | null;
  statusCode: number | null;
  etd: string | null;
  lastUpdated: string | null;
  error: string | null;
  attempts: number;
}

export interface Order {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  total: number;
  status: 'pending' | 'pending_verification' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'payment_failed' | 'tampered';
  createdAt: string;
  deliveredAt?: string | null;
  payment: OrderPayment;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  shiprocket: OrderShiprocket;
  backgroundTasks?: {
    shiprocket?: 'pending' | 'success' | 'failed';
    email?: 'pending' | 'success' | 'failed';
    googleSheets?: 'pending' | 'success' | 'failed';
  };
}

export interface Product {
  id?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  imageFileId?: string;
  variants?: ColorVariant[];
  createdAt: any;
}

export interface ColorVariant {
  color: string;
  hexCode?: string;
  stock: number;
  images: ProductImage[];
}

export interface ProductImage {
  url: string;
  fileId: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  photo?: string;
  createdAt: any;
}
