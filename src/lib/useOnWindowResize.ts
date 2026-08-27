// Tremor useOnWindowResize [v0.0.2]

"use client";

import * as React from "react";

/** Rejoue `handler` au montage puis à chaque redimensionnement de la fenêtre. */
export const useOnWindowResize = (handler: () => void) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler();
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [handler]);
};
