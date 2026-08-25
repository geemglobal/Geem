import { useState, useEffect, useCallback } from "react";

export function useOtpTimer(initialSeconds = 60) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [canResend, setCanResend] = useState(true);

  const startTimer = useCallback(() => {
    setCanResend(false);
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!canResend) setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, canResend]);

  return { secondsLeft, canResend, startTimer };
}
