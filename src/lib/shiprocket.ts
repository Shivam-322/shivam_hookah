import crypto from 'crypto';

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

class ShiprocketService {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  // AUTH — tokens expire every 24 hours, cache them
  async getToken(): Promise<string> {
    const now = Date.now();

    if (this.token && now < this.tokenExpiry - 5 * 60 * 1000) {
      return this.token;
    }

    console.log('[shiprocket] Fetching new auth token...');

    const res = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Shiprocket auth failed: ${err}`);
    }

    const data = await res.json();

    if (!data.token) {
      throw new Error('Shiprocket auth returned no token');
    }

    this.token = data.token;
    this.tokenExpiry = now + 24 * 60 * 60 * 1000;

    console.log('[shiprocket] Auth token obtained successfully');
    return this.token!;
  }

  // PRIVATE API HELPER
  private async apiCall(
    endpoint: string,
    method: string = 'GET',
    body?: object
  ): Promise<any> {
    const token = await this.getToken();

    const res = await fetch(`${SHIPROCKET_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[shiprocket] API error:', endpoint, data);
      throw new Error(
        data.message || 
        data.error || 
        `Shiprocket API error: ${res.status}`
      );
    }

    return data;
  }

  // CREATE SHIPMENT
  async createShipment(order: {
    orderId: string;
    orderDate: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: {
      line1: string;
      city: string;
      state: string;
      pincode: string;
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    totalAmount: number;
  }): Promise<{
    shiprocketOrderId: string;
    shipmentId: string;
    awb: string;
    courierName: string;
  }> {
    console.log('[shiprocket] Creating shipment for order:', order.orderId);

    const orderItems = order.items.map(item => ({
      name: item.name.substring(0, 50), // Shiprocket has name length limit
      selling_price: item.price.toString(),
      units: item.quantity,
      hsn: '',
      sku: `SKU-${Date.now()}`,
      discount: '0',
    }));

    const dateObj = new Date(order.orderDate);
    const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    const nameParts = order.customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const payload = {
      order_id: order.orderId,
      order_date: formattedDate,
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'warehouse',

      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: order.shippingAddress.line1,
      billing_city: order.shippingAddress.city,
      billing_pincode: order.shippingAddress.pincode,
      billing_state: order.shippingAddress.state,
      billing_country: 'India',
      billing_email: order.customerEmail,
      billing_phone: order.customerPhone.replace(/\D/g, '').slice(-10),

      shipping_is_billing: true,

      order_items: orderItems,
      payment_method: 'Prepaid',
      sub_total: order.totalAmount,

      // Default dimensions — adjust for your products
      length: 30,
      breadth: 30,
      height: 50,
      weight: 3.0,
    };

    const data = await this.apiCall('/orders/create/adhoc', 'POST', payload);

    console.log('[shiprocket] Raw response:', JSON.stringify(data, null, 2));

    return {
      shiprocketOrderId: data.order_id?.toString() || '',
      shipmentId: data.shipment_id?.toString() || '',
      awb: data.awb_code || '',
      courierName: data.courier_name || '',
    };
  }

  // GENERATE AWB (tracking number)
  async generateAWB(shipmentId: string): Promise<{
    awb: string;
    courierName: string;
  }> {
    console.log('[shiprocket] Generating AWB for shipment:', shipmentId);

    const data = await this.apiCall('/courier/assign/awb', 'POST', {
      shipment_id: [shipmentId],
    });

    console.log('[shiprocket] AWB response:', JSON.stringify(data, null, 2));

    const response = data.response?.data || data;
    return {
      awb: response.awb_code || response.awb || '',
      courierName: response.courier_name || response.courier || '',
    };
  }

  // GENERATE SHIPPING LABEL
  async generateLabel(shipmentId: string): Promise<string> {
    console.log('[shiprocket] Generating label for shipment:', shipmentId);

    const data = await this.apiCall('/courier/generate/label', 'POST', {
      shipment_id: [shipmentId],
    });

    console.log('[shiprocket] Label response:', JSON.stringify(data, null, 2));
    return data.label_url || data.response?.label_url || '';
  }

  // CANCEL SHIPMENT
  async cancelShipment(shiprocketOrderIds: string[]): Promise<void> {
    await this.apiCall('/orders/cancel', 'POST', {
      ids: shiprocketOrderIds,
    });
    console.log('[shiprocket] Cancelled orders:', shiprocketOrderIds);
  }
}

// Singleton — token is cached across all requests
export const shiprocket = new ShiprocketService();
