import type { DeviceCategory, DeviceProfile, ScreenOrientation } from '../types/math';

export function classifyDevice(
  width: number,
  height: number,
  hasTouch: boolean
): DeviceProfile {
  const orientation: ScreenOrientation = height >= width ? 'pionowy' : 'poziomy';
  let category: DeviceCategory = 'komputer';

  if (width < 640) {
    category = 'telefon';
  } else if (width < 1024 || (hasTouch && width <= 1180)) {
    category = 'tablet';
  } else {
    category = 'komputer';
  }

  const labelMap: Record<DeviceCategory, string> = {
    telefon: 'Telefon',
    tablet: 'Tablet',
    komputer: 'Komputer',
  };

  return {
    category,
    orientation,
    width,
    height,
    hasTouch,
    label: `${labelMap[category]} (${orientation})`,
  };
}
