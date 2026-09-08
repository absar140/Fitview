import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import Ionicons from 'react-native-vector-icons/Ionicons';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function CheckoutScreen() {
    const navigation = useNavigation<NavProp>();
    const [selectedPayment, setSelectedPayment] = useState<'card' | 'apple' | 'cash'>('card');

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </Pressable>
                <Text style={styles.headerTitle}>checkout</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Shipping Address Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>SHIPPING ADDRESS</Text>
                        <Pressable>
                            <Text style={styles.changeLink}>Change</Text>
                        </Pressable>
                    </View>
                    <View style={styles.card}>
                        <View style={styles.addressRow}>
                            <Ionicons name="location-outline" size={20} color="#1A1A1A" style={styles.cardIcon} />
                            <View style={styles.addressInfo}>
                                <Text style={styles.addressName}>Alex Morgan</Text>
                                <Text style={styles.addressText}>742 Evergreen Terrace</Text>
                                <Text style={styles.addressText}>Springfield, OR 97477</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Payment Method Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>PAYMENT METHOD</Text>
                    </View>

                    <Pressable
                        style={[styles.paymentOption, selectedPayment === 'card' && styles.paymentOptionActive]}
                        onPress={() => setSelectedPayment('card')}
                    >
                        <View style={styles.paymentOptionLeft}>
                            <Ionicons name="card-outline" size={20} color="#1A1A1A" />
                            <Text style={styles.paymentOptionText}>Credit / Debit Card (•••• 4821)</Text>
                        </View>
                        <View style={[styles.radioCircle, selectedPayment === 'card' && styles.radioCircleActive]}>
                            {selectedPayment === 'card' && <View style={styles.radioInner} />}
                        </View>
                    </Pressable>

                    <Pressable
                        style={[styles.paymentOption, selectedPayment === 'apple' && styles.paymentOptionActive]}
                        onPress={() => setSelectedPayment('apple')}
                    >
                        <View style={styles.paymentOptionLeft}>
                            <Ionicons name="logo-apple" size={20} color="#1A1A1A" />
                            <Text style={styles.paymentOptionText}>Apple Pay / Google Pay</Text>
                        </View>
                        <View style={[styles.radioCircle, selectedPayment === 'apple' && styles.radioCircleActive]}>
                            {selectedPayment === 'apple' && <View style={styles.radioInner} />}
                        </View>
                    </Pressable>
                </View>

                {/* Order Summary Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
                    <View style={styles.card}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>$185.00</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Shipping (Standard)</Text>
                            <Text style={styles.summaryValue}>Free</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Estimated Tax</Text>
                            <Text style={styles.summaryValue}>$14.80</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>$199.80</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Place Order Bar */}
            <View style={styles.footer}>
                <Pressable
                    style={styles.payButton}
                    onPress={() => navigation.navigate('OrderConfirmed')}
                >
                    <Text style={styles.payButtonText}>place order • $199.80</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 54,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1EFE8',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1EFE8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8A8778',
        letterSpacing: 0.5,
    },
    changeLink: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1A1A1A',
        textDecorationLine: 'underline',
    },
    card: {
        backgroundColor: '#F7F6F2',
        borderRadius: 16,
        padding: 16,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    cardIcon: {
        marginTop: 2,
        marginRight: 12,
    },
    addressInfo: {
        flex: 1,
    },
    addressName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 13,
        color: '#5F5E5A',
        lineHeight: 18,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F7F6F2',
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    paymentOptionActive: {
        borderColor: '#1A1A1A',
        backgroundColor: '#FFFFFF',
    },
    paymentOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    paymentOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D9D6CC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleActive: {
        borderColor: '#1A1A1A',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#1A1A1A',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 13,
        color: '#5F5E5A',
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E2D8',
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 28,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1EFE8',
    },
    payButton: {
        backgroundColor: '#1A1A1A',
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
});
