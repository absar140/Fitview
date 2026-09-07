import { Garment } from '../types/garment';

// Temporary hardcoded catalog data — stands in for a real backend/API call.
// Replace this with a network fetch once the backend is ready.
export const mockGarments: Garment[] = [
    {
        id: 'g1',
        name: 'Classic Denim Jacket',
        category: 'tops',
        price: 68,
        thumbnailUrl: 'https://placehold.co/300x375?text=Denim+Jacket',
        runtimeAssetUrl: 'assets/garments/tops/denim_jacket.png',
        assetType: '2d_mesh',
        // Anchored to both shoulders since a jacket spans the upper torso
        anchorProfile: { primaryLandmarks: ['leftShoulder', 'rightShoulder'], offsetX: 0, offsetY: 0 },
        scale: 1.0,
        mirror: false,
        supportedPoses: ['front'],
    },
    {
        id: 'g2',
        name: 'White Tee',
        category: 'tops',
        price: 24,
        thumbnailUrl: 'https://placehold.co/300x375?text=White+Tee',
        runtimeAssetUrl: 'assets/garments/tops/white_tee.png',
        assetType: '2d_mesh',
        anchorProfile: { primaryLandmarks: ['leftShoulder', 'rightShoulder'], offsetX: 0, offsetY: 0 },
        scale: 1.0,
        mirror: false,
        supportedPoses: ['front'],
    },
    {
        id: 'g3',
        name: 'Running Sneakers',
        category: 'shoes',
        price: 89,
        thumbnailUrl: 'https://placehold.co/300x375?text=Sneakers',
        runtimeAssetUrl: 'assets/garments/shoes/sneaker.png',
        assetType: '2d_mesh',
        // Shoes anchor to a single ankle landmark; mirror=true lets one asset serve both feet
        anchorProfile: { primaryLandmarks: ['leftAnkle'], offsetX: 0, offsetY: 0 },
        scale: 1.0,
        mirror: true,
        supportedPoses: ['front'],
    },
];