import React from 'react';
export interface NavbarProps {
    brandName?: string;
    links?: {
        label: string;
        href: string;
        active?: boolean;
    }[];
    user?: {
        name: string;
        avatarUrl?: string;
    };
    onLogout?: () => void;
    className?: string;
}
export declare const Navbar: React.FC<NavbarProps>;
