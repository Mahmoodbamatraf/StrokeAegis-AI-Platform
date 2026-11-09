import { useEffect, useState } from 'react';
import { appCore, StrokeAegisCore } from './AppCore';

export function useAppCore(): StrokeAegisCore {
  const [, setTick] = useState(0);

  useEffect(() => {
    return appCore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return appCore;
}
