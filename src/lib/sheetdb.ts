export async function logOrderToSheetDB(order: any) {
  const SHEETDB_URL = process.env.SHEETDB_API_URL;

  if (!SHEETDB_URL) {
    console.warn("[SheetDB] API URL not found in environment variables. Skipping logging.");
    return;
  }

  try {
    // Flattening shipping address
    const address = order.shippingAddress;
    const flattenedAddress = `${address.line1}, ${address.city}, ${address.state}, ${address.pincode}`;

    // Flattening items array
    const itemsList = order.items
      .map((item: any) => `${item.quantity}x ${item.name}${item.color ? ` (${item.color})` : ""}`)
      .join(", ");

    const payload = {
      data: [
        {
          createdAt: order.createdAt,
          orderId: order.stripePaymentIntentId || "N/A",
          userId: order.userId,
          userName: order.userName,
          userEmail: order.userEmail,
          phone: address.phone || "N/A",
          address: flattenedAddress,
          items: itemsList,
          total: order.total,
          status: order.status,
        },
      ],
    };

    const response = await fetch(SHEETDB_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SheetDB Error: ${response.status} - ${errorText}`);
    }

    console.log("[SheetDB] Order successfully logged to Google Sheet.");
  } catch (error) {
    console.error("[SheetDB] Failed to log order:", error);
    // We don't throw the error because we don't want to break the main order flow
  }
}
