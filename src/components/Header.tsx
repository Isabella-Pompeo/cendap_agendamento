'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, User, LogOut } from 'lucide-react';
import LoginModal from './LoginModal';

export default function Header() {
    return (
        <header style={{
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid #e2e8f0',
            padding: 'var(--spacing-sm) var(--spacing-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            boxShadow: 'var(--shadow-sm)'
        }}>
            <Image
                src="/logo-cendap.png"
                alt="CENDAP Logo"
                width={50}
                height={50}
                priority
            />
        </header>
    );
}
