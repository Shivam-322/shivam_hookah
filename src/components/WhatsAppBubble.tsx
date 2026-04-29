'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

const WHATSAPP_NUMBER = '919120991695'; // country code + number, no +
const WHATSAPP_MESSAGE = 'Hi! I have a question about your hookah products.';

export default function WhatsAppBubble() {
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();

  // Hide on admin pages
  if (pathname?.startsWith('/admin')) return null;

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      
      {/* Tooltip — shows on hover */}
      <div
        className={`
          transition-all duration-300 ease-in-out
          ${isHovered 
            ? 'opacity-100 translate-x-0' 
            : 'opacity-0 translate-x-4 pointer-events-none'}
          bg-white/10 backdrop-blur-md border border-white/20
          text-white text-sm font-medium
          px-4 py-2 rounded-full
          shadow-lg whitespace-nowrap
        `}
      >
        💬 Chat with us
      </div>

      {/* WhatsApp Bubble Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Chat with us on WhatsApp"
        className="relative flex items-center justify-center w-14 h-14 rounded-full 
                   bg-[#25D366] shadow-lg shadow-[#25D366]/40
                   hover:scale-110 hover:shadow-[#25D366]/60
                   active:scale-95
                   transition-all duration-300 ease-in-out
                   cursor-pointer"
      >
        {/* Pulse ring animation */}
        <span className="absolute inline-flex w-full h-full rounded-full 
                         bg-[#25D366] opacity-50 animate-whatsapp-ping" />
        
        {/* Outer glow ring */}
        <span className="absolute inline-flex w-full h-full rounded-full 
                         bg-[#25D366] opacity-20 scale-110" />

        {/* WhatsApp SVG Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          className="w-8 h-8 relative z-10"
          fill="white"
        >
          <path d="M24 4C13 4 4 13 4 24c0 3.6 1 7 2.7 9.9L4 44l10.3-2.7C17 43 20.4 44 24 44c11 0 20-9 20-20S35 4 24 4zm0 36c-3.1 0-6.1-.8-8.7-2.4l-.6-.4-6.1 1.6 1.6-5.9-.4-.6C8.8 30.1 8 27.1 8 24 8 15.2 15.2 8 24 8s16 7.2 16 16-7.2 16-16 16zm8.7-11.8c-.5-.2-2.8-1.4-3.2-1.5-.4-.2-.7-.2-1 .2-.3.5-1.1 1.5-1.4 1.8-.3.3-.5.3-1 .1-.5-.2-2-.7-3.8-2.3-1.4-1.2-2.3-2.8-2.6-3.2-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.4-.8.2-.3 0-.6-.1-.8-.1-.2-1-2.5-1.4-3.4-.4-.9-.8-.8-1-.8h-.9c-.3 0-.8.1-1.2.6-.4.5-1.6 1.6-1.6 3.8s1.7 4.4 1.9 4.7c.2.3 3.3 5.1 8.1 7.1 1.1.5 2 .8 2.7 1 1.1.3 2.2.3 3 .2.9-.1 2.8-1.1 3.2-2.2.4-1.1.4-2 .3-2.2-.2-.2-.5-.3-1-.5z"/>
        </svg>
      </a>
    </div>
  );
}
