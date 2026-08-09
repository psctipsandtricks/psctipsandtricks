'use client';

import React, { useState } from 'react';
import { cn } from '../utils';

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

export const Tabs: React.FC<TabsProps> = ({ items, defaultTabId, onChange, className }) => {
  const [activeTab, setActiveTab] = useState(defaultTabId || (items[0] ? items[0].id : ''));

  const handleSelect = (id: string) => {
    setActiveTab(id);
    if (onChange) onChange(id);
  };

  const activeContent = items.find((item) => item.id === activeTab)?.content;

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 overflow-x-auto">
        {items.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors focus:outline-none',
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeContent && <div className="py-2">{activeContent}</div>}
    </div>
  );
};
