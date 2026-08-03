import React from 'react';
export interface StatsCardProps {
    title: string;
    value: string | number;
    change?: string;
    isPositive?: boolean;
    icon?: React.ReactNode;
    className?: string;
}
export declare const StatsCard: React.FC<StatsCardProps>;
