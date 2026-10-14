/**
 * Phase 4b (spec §9 "use the mask/occlusion so arms appear correctly"): arm occlusion for the 3D
 * garment, done inside Filament.
 *
 * Two invisible cylinders follow the forearms + hands (from usePoseTracking, worklet thread). They use
 * the custom "holdout" material (assets/materials/holdout.filamat, compiled with matc 1.68.2 = the
 * Filament version inside react-native-filament 1.11.0). Wherever a cylinder is IN FRONT of the
 * garment it overwrites the garment's pixels with fully transparent, so the real arm from the camera
 * shows through the transparent FilamentView. When the arm is behind the body the occluder is
 * switched off by usePoseTracking.
 *
 * Must be rendered as a child of <FilamentView> (inside <FilamentScene>).
 */
import { useEffect, useMemo } from 'react';
import {
  RenderCallbackContext,
  useBuffer,
  useDisposableResource,
  useFilamentContext,
  useModel,
  useWorkletCallback,
} from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import type { ISharedValue } from 'react-native-worklets-core';
import { OCC_STRIDE } from '../cv/usePoseTracking';

const HIDDEN_Z = 100; // behind the Filament camera = not drawn

export function ArmOccluders({ occluders }: { occluders: ISharedValue<number[]> }) {
  const { engine, renderableManager, transformManager, scene, workletContext } = useFilamentContext();

  // addToScene: false -> it only joins the scene after the holdout material is on it (no magenta flash)
  const model = useModel(require('../../../../assets/occluders/arm_occluders.glb'), { addToScene: false });
  const materialBuffer = useBuffer({ source: require('../../../../assets/materials/holdout.filamat') });

  const material = useDisposableResource(
    useWorkletCallback(() => {
      'worklet';
      if (materialBuffer == null) return undefined;
      return engine.createMaterial(materialBuffer);
    }),
    [engine, materialBuffer]
  );

  const asset = model.state === 'loaded' ? model.asset : undefined;
  const entities = useMemo(() => {
    if (asset == null) return undefined;
    const left = asset.getFirstEntityByName('occ_left');
    const right = asset.getFirstEntityByName('occ_right');
    if (left == null || right == null) return undefined;
    return { left, right };
  }, [asset]);

  // Swap the placeholder glTF material for the holdout material, then let the render callback show them.
  const ready = useSharedValue(0);
  useEffect(() => {
    if (material == null || entities == null || asset == null) return;
    const a = asset;
    const left = entities.left;
    const right = entities.right;
    workletContext
      .runAsync(() => {
        'worklet';
        const inst = material.getDefaultInstance();
        renderableManager.setMaterialInstanceAt(left, 0, inst);
        renderableManager.setMaterialInstanceAt(right, 0, inst);
        renderableManager.setCastShadow(left, false);
        renderableManager.setCastShadow(right, false);
        scene.addAssetEntities(a);
      })
      .then(() => {
        ready.value = 1;
      });
    return () => {
      ready.value = 0;
    };
  }, [material, entities, asset, renderableManager, scene, workletContext, ready]);

  const left = entities ? entities.left : undefined;
  const right = entities ? entities.right : undefined;

  RenderCallbackContext.useRenderCallback(() => {
    'worklet';
    if (left == null || right == null) return;
    const o = occluders.value;
    for (let side = 0; side < 2; side++) {
      const entity = side === 0 ? left : right;
      const b = side * OCC_STRIDE;
      const active = ready.value > 0.5 && o.length >= b + OCC_STRIDE && o[b + 6] > 0.5;
      if (!active) {
        transformManager.setEntityPosition(entity, [0, 0, HIDDEN_Z], false);
        continue;
      }
      const x0 = o[b];
      const y0 = o[b + 1];
      const x1 = o[b + 2];
      const y1 = o[b + 3];
      const d = o[b + 4];
      const z = o[b + 5];
      const len = Math.hypot(x1 - x0, y1 - y0);
      // unit cylinder: radius 0.5, from y = 0 to y = 1  ->  T(start) * Rz(angle) * S(d, len, d)
      const angle = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
      transformManager.setEntityScale(entity, [d, Math.max(len, 1e-4), d], false);
      transformManager.setEntityRotation(entity, angle, [0, 0, 1], true);
      transformManager.setEntityPosition(entity, [x0, y0, z], true);
    }
  }, [left, right, occluders, ready, transformManager, OCC_STRIDE]);

  return null;
}
