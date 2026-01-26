'use client';

import { useState, useEffect } from 'react';
import { MainMenu } from './messenger/MainMenu';
import './auth-transition.css';

interface AuthTransitionProps {
  show: boolean;
}

export function AuthTransition({ show }: AuthTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
    }
  }, [show]);

  if (!isVisible) return null;

  return (
    <div className="auth-transition-container">
      <div className={`auth-transition-overlay ${show ? 'fade-out' : ''}`} />
      <div className={`messenger-entrance ${show ? 'slide-in' : ''}`}>
        <MainMenu />
      </div>
    </div>
  );
}
