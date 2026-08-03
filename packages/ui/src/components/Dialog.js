"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dialog = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const utils_1 = require("../utils");
const Dialog = ({ isOpen, onClose, title, description, children, className, }) => {
    if (!isOpen)
        return null;
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200", children: (0, jsx_runtime_1.jsxs)("div", { className: (0, utils_1.cn)('w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl text-slate-900 dark:text-slate-100 relative', className), children: [(0, jsx_runtime_1.jsx)("button", { onClick: onClose, className: "absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors", children: "\u2715" }), title && (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold tracking-tight mb-1", children: title }), description && (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 dark:text-slate-400 mb-4", children: description }), (0, jsx_runtime_1.jsx)("div", { children: children })] }) }));
};
exports.Dialog = Dialog;
