"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOK_SUBSCRIPTION_DURATIONS_LIST = void 0;
exports.formatSubscriptionDuration = formatSubscriptionDuration;
exports.BOOK_SUBSCRIPTION_DURATIONS_LIST = [
    { value: '1_MONTH', label: '1 Month' },
    { value: '3_MONTHS', label: '3 Months' },
    { value: '6_MONTHS', label: '6 Months' },
    { value: '1_YEAR', label: '1 Year (12 Months)' },
];
function formatSubscriptionDuration(duration) {
    switch (duration) {
        case '1_MONTH':
            return '1 Month';
        case '3_MONTHS':
            return '3 Months';
        case '6_MONTHS':
            return '6 Months';
        case '1_YEAR':
            return '1 Year';
        default:
            return duration ? duration.replace(/_/g, ' ') : '';
    }
}
