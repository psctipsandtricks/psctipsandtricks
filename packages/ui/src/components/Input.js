"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Input = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const utils_1 = require("../utils");
exports.Input = react_1.default.forwardRef(({ className, type = 'text', label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "w-full space-y-1.5", children: [label && ((0, jsx_runtime_1.jsx)("label", { htmlFor: inputId, className: "block text-sm font-medium text-slate-700 dark:text-slate-300", children: label })), (0, jsx_runtime_1.jsx)("input", { type: type, id: inputId, ref: ref, className: (0, utils_1.cn)('flex h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors', error && 'border-rose-500 focus:ring-rose-500', className), ...props }), error ? ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-rose-500 font-medium", children: error })) : helperText ? ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: helperText })) : null] }));
});
exports.Input.displayName = 'Input';
