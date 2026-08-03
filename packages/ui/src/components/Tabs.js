"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tabs = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const utils_1 = require("../utils");
const Tabs = ({ items, defaultTabId, onChange, className }) => {
    const [activeTab, setActiveTab] = (0, react_1.useState)(defaultTabId || (items[0] ? items[0].id : ''));
    const handleSelect = (id) => {
        setActiveTab(id);
        if (onChange)
            onChange(id);
    };
    const activeContent = items.find((item) => item.id === activeTab)?.content;
    return ((0, jsx_runtime_1.jsxs)("div", { className: (0, utils_1.cn)('w-full space-y-4', className), children: [(0, jsx_runtime_1.jsx)("div", { className: "flex border-b border-slate-200 dark:border-slate-800 space-x-2 overflow-x-auto", children: items.map((tab) => {
                    const isActive = tab.id === activeTab;
                    return ((0, jsx_runtime_1.jsx)("button", { onClick: () => handleSelect(tab.id), className: (0, utils_1.cn)('px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors focus:outline-none', isActive
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'), children: tab.label }, tab.id));
                }) }), activeContent && (0, jsx_runtime_1.jsx)("div", { className: "py-2", children: activeContent })] }));
};
exports.Tabs = Tabs;
