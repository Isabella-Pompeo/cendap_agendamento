"use client";

import React from 'react';
import { Calendar, Search, FlaskConical, ClipboardList } from 'lucide-react';
import styles from './FloatingNavbar.module.css';

interface FloatingNavbarProps {
  activeTab: 'doctors' | 'services' | 'search';
  onAction: (action: 'doctors' | 'services' | 'search' | 'results') => void;
}

const CustomCalendarIcon = ({ size, color }: { size: number; color: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10,22.5c0,.829-.671,1.5-1.5,1.5h-3c-3.033,0-5.5-2.467-5.5-5.5V7.5C0,4.467,2.467,2,5.5,2h.5v-.5c0-.829,.671-1.5,1.5-1.5s1.5,.671,1.5,1.5v.5h6v-.5c0-.829,.672-1.5,1.5-1.5s1.5,.671,1.5,1.5v.5h.5c3.032,0,5.5,2.467,5.5,5.5,0,.829-.672,1.5-1.5,1.5H3v9.5c0,1.378,1.122,2.5,2.5,2.5h3c.829,0,1.5,.671,1.5,1.5Zm14-5c0,3.59-2.91,6.5-6.5,6.5s-6.5-2.91-6.5-6.5,2.91-6.5,6.5-6.5,6.5,2.91,6.5,6.5Zm-4.156,.223l-.844-.844v-1.379c0-.828-.672-1.5-1.5-1.5s-1.5,.672-1.5,1.5v1.793c0,.53,.211,1.039,.586,1.414l1.137,1.137c.586,.586,1.535,.586,2.121,0,.586-.586,.586-1.535,0-2.121Z"/>
  </svg>
);

const FloatingNavbar = ({ activeTab, onAction }: FloatingNavbarProps) => {
  const navItems = [
    { id: 'doctors' as const, icon: CustomCalendarIcon, label: 'Médicos', shortLabel: 'Agenda' },
    { id: 'services' as const, icon: ClipboardList, label: 'Exames e Preços', shortLabel: 'Exames' },
    { id: 'search' as const, icon: Search, label: 'Minhas Agendas', shortLabel: 'Status' },
    { id: 'results' as const, icon: FlaskConical, label: 'Resultados Laboratoriais', shortLabel: 'Resultados' },
  ];

  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => onAction(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <div className={styles.iconWrapper}>
                <IconComponent 
                  size={28} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  color={isActive ? '#ffffff' : '#b0b0b0'}
                />
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default FloatingNavbar;
