"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const utils_1 = require("../utils");
const Sidebar = ({ items, brandName = 'PSC Admin', className, }) => {
    return ((0, jsx_runtime_1.jsxs)("aside", { className: (0, utils_1.cn)('w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 min-h-screen flex flex-col', className), children: [(0, jsx_runtime_1.jsxs)("div", { className: "h-16 flex items-center px-6 border-b border-slate-800 font-bold text-lg tracking-wide text-amber-400", children: ["\u26A1 ", brandName] }), (0, jsx_runtime_1.jsx)("nav", { className: "flex-1 px-4 py-6 space-y-1.5 overflow-y-auto", children: items.map((item) => ((0, jsx_runtime_1.jsxs)("a", { href: item.href, className: (0, utils_1.cn)('flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors', item.active
                        ? 'bg-indigo-600 text-white font-semibold shadow-md'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'), children: [item.icon && (0, jsx_runtime_1.jsx)("span", { className: "w-5 h-5", children: item.icon }), (0, jsx_runtime_1.jsx)("span", { children: item.label })] }, item.id))) }), (0, jsx_runtime_1.jsx)("div", { className: "p-4 border-t border-slate-800 text-xs text-slate-500 text-center", children: "PSC Tips & Tricks Admin v1.0" })] }));
};
exports.Sidebar = Sidebar;
