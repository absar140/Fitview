import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Garment } from '../types/garment';

// Shape of one item sitting in the cart.
// Extends garment info with quantity + selected variant details.
export type CartItem = {
    id: string; // garment id
    name: string;
    price: number;
    thumbnailUrl: string;
    size: string;
    color: string;
    quantity: number;
};

// Everything the Cart Context exposes to any screen that uses it
type CartContextType = {
    items: CartItem[];
    addToCart: (garment: Garment, size: string, color: string) => void;
    removeFromCart: (id: string) => void;
    updateQuantity: (id: string, delta: number) => void;
    clearCart: () => void;
    totalItems: number;
    subtotal: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

// Wraps the whole app (see App.tsx) so any nested screen can access
// cart state via useCart(), without passing props down manually
// through every level of the navigation tree.
export function CartProvider({ children }: { children: ReactNode }) {
    // Starts empty — this is the actual fix for "must be empty initially"
    const [items, setItems] = useState<CartItem[]>([]);

    const addToCart = (garment: Garment, size: string, color: string) => {
        setItems((prev) => {
            // If this exact garment+size+color combo is already in the cart,
            // just bump its quantity instead of creating a duplicate row.
            const existing = prev.find(
                (item) => item.id === garment.id && item.size === size && item.color === color
            );
            if (existing) {
                return prev.map((item) =>
                    item.id === garment.id && item.size === size && item.color === color
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            // Otherwise add it as a new cart line
            return [
                ...prev,
                {
                    id: garment.id,
                    name: garment.name,
                    price: garment.price,
                    thumbnailUrl: garment.thumbnailUrl,
                    size,
                    color,
                    quantity: 1,
                },
            ];
        });
    };

    const removeFromCart = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const updateQuantity = (id: string, delta: number) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
            )
        );
    };

    const clearCart = () => setItems([]);

    // Derived values recalculated on every render from current `items`
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <CartContext.Provider
            value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, subtotal }}
        >
            {children}
        </CartContext.Provider>
    );
}

// Custom hook so screens just call useCart() instead of importing
// useContext + CartContext every time. Throws a clear error if someone
// tries to use it outside the provider, instead of a silent undefined bug.
export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}