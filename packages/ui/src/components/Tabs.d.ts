import React from 'react';
export interface TabItem {
    id: string;
    label: string;
    content?: React.ReactNode;
}
export interface TabsProps {
    items: TabItem[];
    defaultTabId?: string;
    onChange?: (tabId: string) => void;
    className?: string;
}
export declare const Tabs: React.FC<TabsProps>;
