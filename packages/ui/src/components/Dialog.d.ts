import React from 'react';
export interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}
export declare const Dialog: React.FC<DialogProps>;
