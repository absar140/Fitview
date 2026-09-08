// Expanded to match the actual categories shown in the Categories screen banners
export type GarmentCategory = 'dresses' | 'outerwear' | 'knitwear' | 'bags' | 'shoes' | 'accessories';
export type AssetType = '2d_mesh' | '3d_model';

export interface AnchorProfile {
    primaryLandmarks: string[];
    offsetX: number;
    offsetY: number;
}

export interface Garment {
    id: string;
    name: string;
    category: GarmentCategory;
    price: number;
    thumbnailUrl: string;
    runtimeAssetUrl: string;
    assetType: AssetType;
    anchorProfile: AnchorProfile;
    scale: number;
    mirror: boolean;
    supportedPoses: string[];
}