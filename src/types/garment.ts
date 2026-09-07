export type GarmentCategory = 'tops' | 'bottoms' | 'shoes' | 'accessories';

export interface AnchorProfile {
    primaryLandmarks: string[];
    offsetX: number;
    offsetY: number;
}

export interface Garment {
    id: string;
    name: string;
    category: GarmentCategory | string;
    price: number;
    thumbnailUrl: string;
    runtimeAssetUrl: string;
    assetType: '2d_mesh' | '3d_mesh' | string;
    anchorProfile: AnchorProfile;
    scale: number;
    mirror: boolean;
    supportedPoses: string[];
}
