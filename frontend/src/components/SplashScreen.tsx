"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Lottie, { LottieRefCurrentProps } from "lottie-react";

interface LottieData {
  w?: number;
  h?: number;
  [key: string]: unknown;
}

export function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [animationData, setAnimationData] = useState<LottieData | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
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

  // Size the player to the animation's own aspect ratio, fully contained within the
  // viewport — never cropped, never distorted, no leftover border artifacts.
  useEffect(() => {
    if (!animationData?.w || !animationData?.h) return;
    const ratio = animationData.w / animationData.h;

    function compute() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw / vh > ratio) {
        setSize({ height: vh, width: vh * ratio });
      } else {
        setSize({ width: vw, height: vw / ratio });
      }
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [animationData]);

  const finish = () => {
    setVisible(false);
    if (typeof window !== "undefined") sessionStorage.setItem("pp-splash-shown", "1");
  };

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#eceae6" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeOut" } }}
        >
          {animationData && size.width > 0 && (
            <div style={{ width: size.width, height: size.height }}>
              <Lottie
                lottieRef={lottieRef}
                animationData={animationData}
                loop={false}
                autoplay
                onComplete={finish}
                rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
