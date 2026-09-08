import React from 'react';
import { View, StyleSheet } from 'react-native';

interface IconProps {
    size?: number;
    color?: string;
    focused?: boolean;
}

export function HomeIcon({ color = '#1A1A1A', focused = false }: IconProps) {
    return (
        <View style={styles.iconContainer}>
            <View style={[styles.homeRoof, { borderBottomColor: color }]} />
            <View
                style={[
                    styles.homeBody,
                    { borderColor: color },
                    focused && { backgroundColor: color },
                ]}
            >
                {!focused && <View style={[styles.homeDoor, { backgroundColor: color }]} />}
            </View>
        </View>
    );
}

export function ShopIcon({ color = '#1A1A1A', focused = false }: IconProps) {
    return (
        <View style={styles.gridContainer}>
            <View style={styles.gridRow}>
                <View style={[styles.gridItem, { borderColor: color }, focused && { backgroundColor: color }]} />
                <View style={[styles.gridItem, { borderColor: color }, focused && { backgroundColor: color }]} />
            </View>
            <View style={styles.gridRow}>
                <View style={[styles.gridItem, { borderColor: color }, focused && { backgroundColor: color }]} />
                <View style={[styles.gridItem, { borderColor: color }, focused && { backgroundColor: color }]} />
            </View>
        </View>
    );
}

export function TryOnIcon({ color = '#1A1A1A', focused = false }: IconProps) {
    return (
        <View style={styles.iconContainer}>
            <View
                style={[
                    styles.sparkleMain,
                    { borderColor: color },
                    focused && { backgroundColor: color },
                ]}
            />
            <View style={[styles.sparkleMini, { backgroundColor: color }]} />
        </View>
    );
}

export function CartIcon({ color = '#1A1A1A', focused = false }: IconProps) {
    return (
        <View style={styles.iconContainer}>
            <View style={[styles.bagHandle, { borderColor: color }]} />
            <View
                style={[
                    styles.bagBody,
                    { borderColor: color },
                    focused && { backgroundColor: color },
                ]}
            />
        </View>
    );
}

export function ProfileIcon({ color = '#1A1A1A', focused = false }: IconProps) {
    return (
        <View style={styles.iconContainer}>
            <View
                style={[
                    styles.userHead,
                    { borderColor: color },
                    focused && { backgroundColor: color },
                ]}
            />
            <View
                style={[
                    styles.userBody,
                    { borderColor: color },
                    focused && { backgroundColor: color },
                ]}
            />
        </View>
    );
}

export function HeartIcon({ color = '#1A1A1A', filled = false }: { color?: string; filled?: boolean }) {
    return (
        <View style={styles.heartWrapper}>
            <View
                style={[
                    styles.heartLeft,
                    { borderColor: color },
                    filled && { backgroundColor: color },
                ]}
            />
            <View
                style={[
                    styles.heartRight,
                    { borderColor: color },
                    filled && { backgroundColor: color },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Home
    homeRoof: {
        width: 0,
        height: 0,
        borderLeftWidth: 9,
        borderRightWidth: 9,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    homeBody: {
        width: 14,
        height: 10,
        borderWidth: 1.8,
        borderTopWidth: 0,
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    homeDoor: {
        width: 4,
        height: 5,
        borderTopLeftRadius: 1,
        borderTopRightRadius: 1,
    },
    // Grid / Shop
    gridContainer: {
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 3,
    },
    gridRow: {
        flexDirection: 'row',
        gap: 3,
    },
    gridItem: {
        width: 8,
        height: 8,
        borderWidth: 1.8,
        borderRadius: 2,
    },
    // Sparkles / Try-on
    sparkleMain: {
        width: 14,
        height: 14,
        borderWidth: 1.8,
        borderRadius: 3,
        transform: [{ rotate: '45deg' }],
    },
    sparkleMini: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 5,
        height: 5,
        borderRadius: 1,
        transform: [{ rotate: '45deg' }],
    },
    // Cart / Bag
    bagHandle: {
        width: 8,
        height: 5,
        borderWidth: 1.8,
        borderBottomWidth: 0,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        marginBottom: -1,
    },
    bagBody: {
        width: 16,
        height: 13,
        borderWidth: 1.8,
        borderRadius: 3,
    },
    // Profile
    userHead: {
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.8,
        marginBottom: 2,
    },
    userBody: {
        width: 16,
        height: 8,
        borderWidth: 1.8,
        borderBottomWidth: 0,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    // Heart
    heartWrapper: {
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heartLeft: {
        position: 'absolute',
        left: 2,
        top: 2,
        width: 8,
        height: 12,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderWidth: 1.5,
        transform: [{ rotate: '-45deg' }],
    },
    heartRight: {
        position: 'absolute',
        right: 2,
        top: 2,
        width: 8,
        height: 12,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderWidth: 1.5,
        transform: [{ rotate: '45deg' }],
    },
    // Search
    searchCircle: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1.8,
    },
    searchHandle: {
        position: 'absolute',
        bottom: 3,
        right: 4,
        width: 2,
        height: 6,
        transform: [{ rotate: '-45deg' }],
    },
});

export function SearchIcon({ color = '#1A1A1A' }: { color?: string }) {
    return (
        <View style={styles.iconContainer}>
            <View style={[styles.searchCircle, { borderColor: color }]} />
            <View style={[styles.searchHandle, { backgroundColor: color }]} />
        </View>
    );
}

export function HeaderBagIcon({ color = '#1A1A1A' }: { color?: string }) {
    return <CartIcon color={color} focused={false} />;
}
