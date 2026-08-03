import React from 'react';
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
}
export declare const Card: React.FC<CardProps>;
export declare const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>>;
export declare const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
export declare const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;
export declare const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>>;
export declare const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>>;
