'use client';

import React, { useEffect, useState } from 'react';
import './landscape-background.css';

interface LandscapeBackgroundProps {
  zoomMode?: 'default' | 'login' | 'register';
}

export const LandscapeBackground: React.FC<LandscapeBackgroundProps> = ({ 
  zoomMode = 'default' 
}) => {
  const [currentZoom, setCurrentZoom] = useState<'default' | 'login' | 'register'>('default');

  useEffect(() => {
    if (zoomMode !== currentZoom) {
      // Reset and then apply new zoom
      setCurrentZoom('default');
      const timer = setTimeout(() => {
        setCurrentZoom(zoomMode);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [zoomMode, currentZoom]);

  let zoomClass = 'landscape';
  if (currentZoom === 'login') {
    zoomClass = 'landscape zoom-login';
  } else if (currentZoom === 'register') {
    zoomClass = 'landscape zoom-register';
  }

  return (
    <div className="landscape-container">
      <div className={zoomClass} />
    </div>
  );
};

export default LandscapeBackground;
