"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Badge = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const utils_1 = require("../utils");
const Badge = ({ className, variant = 'default', children, ...props }) => {
    const variants = {
        default: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        success: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        warning: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        danger: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        outline: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300',
        gold: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', variants[variant], className), ...props, children: children }));
};
exports.Badge = Badge;
