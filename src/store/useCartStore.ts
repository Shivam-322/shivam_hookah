import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  color?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, color?: string) => void;
  updateQuantity: (productId: string, color: string | undefined, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => {
        const existingItem = state.items.find((i) => i.productId === item.productId && i.color === item.color);
        if (existingItem) {
          return {
            items: state.items.map((i) =>
              (i.productId === item.productId && i.color === item.color)
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (productId, color) => set((state) => ({
        items: state.items.filter((i) => !(i.productId === productId && i.color === color)),
      })),
      updateQuantity: (productId, color, quantity) => set((state) => ({
        items: state.items.map((i) =>
          (i.productId === productId && i.color === color) ? { ...i, quantity } : i
        ),
      })),
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
