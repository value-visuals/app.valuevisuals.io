"use client";

import { motion } from "framer-motion";

export default function Loading() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 bg-background flex items-center justify-center z-50"
    >
      <Spinner />
    </motion.div>
  );
}

function Spinner() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ring */}
      <motion.div
        className="h-20 w-20 rounded-full border-4 border-t-transparent border-primary"
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          duration: 1,
          ease: "linear",
        }}
      />
      {/* Inner pulse */}
      <motion.div
        className="absolute h-10 w-10 rounded-full bg-primary/30"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [1, 0.5, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.2,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
