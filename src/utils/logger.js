// src/utils/logger.js

// Định nghĩa các mã màu ANSI
const colors = {
    info: "\x1b[32m", // Xanh lá
    warn: "\x1b[33m", // Vàng
    error: "\x1b[31m", // Đỏ
    reset: "\x1b[0m"  // Đặt lại màu về mặc định
};

const logger = {
    verbose: (...args) => {
        console.log(`${colors.info}VERBOSE${colors.reset}`, ...args);
    },
    info: (...args) => {
        console.log(`${colors.info}INFO${colors.reset}`, ...args);
    },
    warn: (...args) => {
        console.log(`${colors.warn}WARN${colors.reset}`, ...args);
    },
    error: (...args) => {
        console.log(`${colors.error}ERROR${colors.reset}`, ...args);
    },
};

module.exports = logger;
