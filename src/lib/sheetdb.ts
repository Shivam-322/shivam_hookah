const SHEETDB_API_URL = process.env.SHEETDB_API_URL || '';

class SheetDBService {

  async addOrder(order: {
    orderId: string;
    createdAt: string;
    userName: string;
    userEmail: string;
    phone: string;
    total: number;
    razorpayPaymentId: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    shippingAddress: {
      line1: string;
      city: string;
      state: string;
      pincode: string;
    };
  }): Promise<void> {
    if (!SHEETDB_API_URL) {
      console.warn('[sheetdb] API URL not set — skipping');
      return;
    }

    const itemsString = order.items
      .map(i => `${i.name} x${i.quantity} @₹${i.price}`)
      .join(' | ');

    const row = {
      'Order ID': order.orderId,
      'Date': new Date(order.createdAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      'Customer Name': order.userName,
      'Customer Email': order.userEmail,
      'Phone': order.phone,
      'Total (INR)': `₹${order.total.toFixed(2)}`,
      'Payment ID': order.razorpayPaymentId,
      'Items': itemsString,
      'Shipping Address': order.shippingAddress.line1,
      'City': order.shippingAddress.city,
      'State': order.shippingAddress.state,
      'Pincode': order.shippingAddress.pincode,
      'Order Status': 'Confirmed',
      'Shiprocket ID': '',
      'AWB': '',
      'Courier': '',
      'Shipping Status': 'Pending',
      'Label URL': '',
    };

    const res = await fetch(SHEETDB_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [row] }),
    });

    if (!res.ok) {
      throw new Error(`SheetDB POST failed: ${await res.text()}`);
    }

    console.log('[sheetdb] ✅ Order added to sheets:', order.orderId);
  }

  async updateOrderStatus(
    orderId: string,
    updates: {
      orderStatus?: string;
      shiprocketId?: string;
      awb?: string;
      courier?: string;
      shippingStatus?: string;
      labelUrl?: string;
    }
  ): Promise<void> {
    if (!SHEETDB_API_URL) return;

    const updateData: Record<string, string> = {};
    if (updates.orderStatus) updateData['Order Status'] = updates.orderStatus;
    if (updates.shiprocketId) updateData['Shiprocket ID'] = updates.shiprocketId;
    if (updates.awb) updateData['AWB'] = updates.awb;
    if (updates.courier) updateData['Courier'] = updates.courier;
    if (updates.shippingStatus) updateData['Shipping Status'] = updates.shippingStatus;
    if (updates.labelUrl) updateData['Label URL'] = updates.labelUrl;

    const res = await fetch(
      `${SHEETDB_API_URL}/Order ID/${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updateData }),
      }
    );

    if (!res.ok) {
      throw new Error(`SheetDB PATCH failed: ${await res.text()}`);
    }

    console.log('[sheetdb] ✅ Order updated in sheets:', orderId);
  }
}

export const sheetdb = new SheetDBService();
