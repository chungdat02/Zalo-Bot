// src/core/handleCommand.js

const { readdirSync } = require("fs");
const path = require('path');
const logger = require('../utils/logger'); // Nhập logger

module.exports = () => {
    const client = global.client;
    const commandPath = path.join(__dirname, '..', 'modules', 'commands');
    const commandFile = readdirSync(commandPath).filter(File => File.endsWith('.js'));
    
    let commandCount = 0,
        replyCount = 0,
        noprefixCount = 0,
        onloadCount = 0,
        anyEventCount = 0;
    
    const commandNames = []; // Danh sách để lưu tên các lệnh

    for (const File of commandFile) {
        delete require.cache[require.resolve(path.join(commandPath, File))];
        const command = require(path.join(commandPath, File));
        if (!command.config.name) continue; // Thay đổi return thành continue để tiếp tục xử lý các lệnh khác

        if (command.run) {
            client.commands.set(command.config.name, command);
            commandCount++;
            commandNames.push(command.config.name); // Thêm tên lệnh vào danh sách
        }

        if (command.noprefix) {
            noprefixCount++;
        }

        if (command.onload) {
            onloadCount++;
        }

        if (command.handleReply) {
            replyCount++;
        }

        if (command.anyEvent) {
            anyEventCount++;
        }
    }

    // Tạo chuỗi tên lệnh với mỗi lệnh xuống hàng
    const commandNamesString = commandNames.length > 0 ? commandNames.join('\n') : 'Không có lệnh';

    logger.info('Đã load thành công', commandCount, 'lệnh:\n', commandNamesString, /*'\n', replyCount, 'lệnh reply,', noprefixCount, 'lệnh không prefix,', onloadCount, 'lệnh onload,', anyEventCount, 'lệnh anyEvent.'*/);
};
