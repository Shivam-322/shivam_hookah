interface OrderStatusBadgeProps {
  status: string;
  shippingStatus?: string;
  shippingStatusLabel?: string;
  awb?: string;
  courierName?: string;
}

export default function OrderStatusBadge({ 
  status, 
  shippingStatus,
  shippingStatusLabel,
  awb,
  courierName,
}: OrderStatusBadgeProps) {

  // Determine badge config based on combined status
  const getBadgeConfig = () => {
    // Problem statuses — show in red
    if (['undelivered', 'delivery_failed', 'rto_initiated', 
         'rto_delivered', 'lost', 'damaged'].includes(shippingStatus || '')) {
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-500/40',
        text: 'text-red-400',
        dot: 'bg-red-400',
        label: shippingStatusLabel || 'Issue',
        pulse: true,
      };
    }

    // Cancelled
    if (status === 'cancelled' || shippingStatus === 'cancelled') {
      return {
        bg: 'bg-gray-500/20',
        border: 'border-gray-500/40',
        text: 'text-gray-400',
        dot: 'bg-gray-400',
        label: 'Cancelled',
        pulse: false,
      };
    }

    // Delivered
    if (status === 'delivered' || shippingStatus === 'delivered') {
      return {
        bg: 'bg-green-500/20',
        border: 'border-green-500/40',
        text: 'text-green-400',
        dot: 'bg-green-400',
        label: 'Delivered',
        pulse: false,
      };
    }

    // Out for delivery
    if (shippingStatus === 'out_for_delivery') {
      return {
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/40',
        text: 'text-blue-300',
        dot: 'bg-blue-300',
        label: 'Out for Delivery',
        pulse: true,
      };
    }

    // In transit / picked up
    if (['in_transit', 'picked_up', 'pickup_queued'].includes(shippingStatus || '')) {
      return {
        bg: 'bg-purple-500/20',
        border: 'border-purple-500/40',
        text: 'text-purple-400',
        dot: 'bg-purple-400',
        label: shippingStatusLabel || 'In Transit',
        pulse: false,
      };
    }

    // Pickup pending
    if (shippingStatus === 'pickup_pending') {
      return {
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500/40',
        text: 'text-yellow-400',
        dot: 'bg-yellow-400',
        label: 'Pickup Pending',
        pulse: false,
      };
    }

    // Shipped (shipment created but no detailed status yet)
    if (status === 'shipped' || shippingStatus === 'shipment_created') {
      return {
        bg: 'bg-orange-500/20',
        border: 'border-orange-500/40',
        text: 'text-orange-400',
        dot: 'bg-orange-400',
        label: 'Shipped',
        pulse: false,
      };
    }

    // Shiprocket failed
    if (shippingStatus === 'shiprocket_failed') {
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-500/40',
        text: 'text-red-400',
        dot: 'bg-red-400',
        label: 'Ship Failed',
        pulse: false,
      };
    }

    // Default: Confirmed
    return {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/40',
      text: 'text-blue-400',
      dot: 'bg-blue-400',
      label: 'Confirmed',
      pulse: false,
    };
  };

  const config = getBadgeConfig();

  return (
    <div className="flex flex-col gap-1">
      {/* Main status badge */}
      <span className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest
        border ${config.bg} ${config.border} ${config.text}
        whitespace-nowrap uppercase
      `}>
        {/* Animated dot for active statuses */}
        <span className="relative flex h-2 w-2">
          {config.pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full 
                             rounded-full opacity-75 ${config.dot}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
        {config.label}
      </span>

      {/* AWB sub-label — show when available */}
      {awb && (
        <span className="text-[10px] text-muted-foreground font-mono pl-1 uppercase tracking-tighter">
          {courierName && `${courierName} • `}{awb}
        </span>
      )}
    </div>
  );
}
