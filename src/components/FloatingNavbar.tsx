"use client";

import React from 'react';
import { Calendar, Search, FlaskConical, ClipboardList } from 'lucide-react';
import styles from './FloatingNavbar.module.css';

interface FloatingNavbarProps {
  activeTab: 'doctors' | 'services' | 'search';
  onAction: (action: 'doctors' | 'services' | 'search' | 'results') => void;
}

const FloatingNavbar = ({ activeTab, onAction }: FloatingNavbarProps) => {
  const navItems = [
    { id: 'doctors' as const, icon: Calendar, label: 'Médicos' },
    { id: 'services' as const, icon: ClipboardList, label: 'Exames e Preços' },
    { id: 'search' as const, icon: Search, label: 'Minhas Agendas' },
    { id: 'results' as const, icon: FlaskConical, label: 'Resultados Laboratoriais' },
  ];

  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        {navItems.map((item) => {
          const IconComponent = item.icon;
          // 'results' won't be an active tab because it opens a modal, but others will match
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => onAction(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <IconComponent 
                size={26} 
                strokeWidth={isActive ? 2.5 : 2} 
                color={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default FloatingNavbar;
