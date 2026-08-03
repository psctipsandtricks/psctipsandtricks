"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardFooter = exports.CardContent = exports.CardDescription = exports.CardTitle = exports.CardHeader = exports.Card = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const utils_1 = require("../utils");
const Card = ({ className, hoverEffect = false, children, ...props }) => {
    return ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)('rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm p-6', hoverEffect && 'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700', className), ...props, children: children }));
};
exports.Card = Card;
const CardHeader = ({ className, children, ...props }) => ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)('flex flex-col space-y-1.5 pb-4', className), ...props, children: children }));
exports.CardHeader = CardHeader;
const CardTitle = ({ className, children, ...props }) => ((0, jsx_runtime_1.jsx)("h3", { className: (0, utils_1.cn)('text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100', className), ...props, children: children }));
exports.CardTitle = CardTitle;
const CardDescription = ({ className, children, ...props }) => ((0, jsx_runtime_1.jsx)("p", { className: (0, utils_1.cn)('text-sm text-slate-500 dark:text-slate-400', className), ...props, children: children }));
exports.CardDescription = CardDescription;
const CardContent = ({ className, children, ...props }) => ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)('pt-0', className), ...props, children: children }));
exports.CardContent = CardContent;
const CardFooter = ({ className, children, ...props }) => ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)('flex items-center pt-4 border-t border-slate-100 dark:border-slate-800', className), ...props, children: children }));
exports.CardFooter = CardFooter;
