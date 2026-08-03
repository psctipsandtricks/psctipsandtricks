"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsCard = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const utils_1 = require("../utils");
const StatsCard = ({ title, value, change, isPositive = true, icon, className, }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: (0, utils_1.cn)('rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm', className), children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-slate-500 dark:text-slate-400", children: title }), icon && (0, jsx_runtime_1.jsx)("div", { className: "p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400", children: icon })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex items-baseline justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100", children: value }), change && ((0, jsx_runtime_1.jsxs)("span", { className: (0, utils_1.cn)('text-xs font-semibold px-2 py-0.5 rounded-full', isPositive ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'), children: [isPositive ? '↑' : '↓', " ", change] }))] })] }));
};
exports.StatsCard = StatsCard;
