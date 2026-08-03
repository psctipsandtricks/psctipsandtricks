import React from 'react';
export interface SidebarItem {
    id: string;
    label: string;
    href: string;
    icon?: React.ReactNode;
    active?: boolean;
}
export interface SidebarProps {
    items: SidebarItem[];
    brandName?: string;
    className?: string;
}
export declare const Sidebar: React.FC<SidebarProps>;
