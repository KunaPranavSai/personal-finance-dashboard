"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Lottie, { LottieRefCurrentProps } from "lottie-react";

export function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [animationData, setAnimationData] = useState<object | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("pp-splash-shown")) {
      setVisible(false);
      onFinish?.();
      return;
    }
    fetch("/landing_page.json")
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch(() => {
        // If the animation fails to load, don't block the app.
        setVisible(false);
        if (typeof window !== "undefined") sessionStorage.setItem("pp-splash-shown", "1");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    setVisible(false);
    if (typeof window !== "undefined") sessionStorage.setItem("pp-splash-shown", "1");
  };

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-white"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeOut" } }}
        >
          {animationData && (
            <Lottie
              lottieRef={lottieRef}
              animationData={animationData}
              loop={false}
              autoplay
              onComplete={finish}
              rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
              className="h-full w-full"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
