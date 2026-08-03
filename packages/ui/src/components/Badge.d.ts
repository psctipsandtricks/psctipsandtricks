import React from 'react';
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'gold';
}
export declare const Badge: React.FC<BadgeProps>;
