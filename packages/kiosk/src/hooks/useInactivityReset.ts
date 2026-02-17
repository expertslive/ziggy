import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKioskStore } from '../store/kiosk';

const INACTIVITY_TIMEOUT = 60_000; // 60 seconds

export function useInactivityReset() {
  const navigate = useNavigate();
  const lastInteraction = useKioskStore((s) => s.lastInteraction);

  useEffect(() => {
    const checkInactivity = () => {
      const elapsed = Date.now() - lastInteraction;
      if (elapsed >= INACTIVITY_TIMEOUT) {
        navigate('/now', { replace: true });
      }
    };

    const timer = setInterval(checkInactivity, 1_000);
    return () => clearInterval(timer);
  }, [lastInteraction, navigate]);
}
