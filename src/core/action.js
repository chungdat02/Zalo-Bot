module.exports = (api) => {
    function anyEvent(event) {
        global.client.events.forEach(eventHandler => {
            if (eventHandler.anyEvent) eventHandler.anyEvent(api, event);
        });
        global.client.commands.forEach(commandHandler => {
            if (commandHandler.anyEvent) commandHandler.anyEvent(api, event);
        });
    }
    
    function onLoad() {
        global.client.events.forEach(eventHandler => {
            if (eventHandler.onload) eventHandler.onload(api);
        });
        global.client.commands.forEach(commandHandler => {
            if (commandHandler.onload) commandHandler.onload(api);
        });
    }
    
    function handleReaction(event) {
        if (!Array.isArray(global.client.handleReaction)) {
            console.error('global.client.handleReaction không phải là mảng:', global.client.handleReaction);
            return;
        }

        const reactionHandler = global.client.handleReaction.find(item => item.messageID == event.messageID);
        if (reactionHandler) {
            const command = global.client.commands.get(reactionHandler.name);
            if (command && typeof command.handleReaction === 'function') {
                command.handleReaction(api, event, reactionHandler);
            } else {
                console.error('Command không tồn tại hoặc không có phương thức handleReaction:', reactionHandler.name);
            }
        } else {
            console.log('Không tìm thấy reaction handler cho messageID:', event.messageID);
        }
    }

    function handleReply(event) {
        if (!Array.isArray(global.client.handleReply)) {
            console.error('global.client.handleReply không phải là mảng:', global.client.handleReply);
            return;
        }

        const replyHandler = global.client.handleReply.find(item => item.messageID == event.messageReply.messageID);
        if (replyHandler) {
            const command = global.client.commands.get(replyHandler.name);
            if (command && typeof command.handleReply === 'function') {
                command.handleReply(api, event, replyHandler);
            } else {
                console.error('Command không tồn tại hoặc không có phương thức handleReply:', replyHandler.name);
            }
        } else {
            console.log('Không tìm thấy reply handler cho messageID:', event.messageReply.messageID);
        }
    }
    
    function handleEvent(event) {
        if (event.type !== 'event') return;
        global.client.events.forEach(eventHandler => eventHandler.run(api, event));
    }
    
    function findClosestCommand(input, commands) {
        return commands.reduce((closest, command) => {
            const distance = levenshtein.get(input, command);
            return distance < levenshtein.get(input, closest) ? command : closest;
        });
    }
    
    function handleCommand(args) {
        if (!Array.isArray(args)) {
            console.error('Expected args to be an array, got:', args);
            return;
        }

        if (args.length === 0 || typeof args[0] !== 'string') {
            console.error('Expected non-empty array with a string as the first element, got:', args);
            return;
        }

        if (args[0].startsWith('!')) {
            const command = args[0].slice(1).toLowerCase();
            if (global.client.commands.has(command)) {
                global.client.commands.get(command).run(api, args);
            } else {
                const listCommands = [...global.client.commands.keys()];
                const closestCommand = findClosestCommand(command, listCommands);
                api.sendMessage(`⛔ Lệnh bạn nhập không tồn tại!\n♟️ Lệnh gần giống nhất là: ${closestCommand}`, args[1] || event.threadID);
            }
        } else {
            console.log('Lệnh không bắt đầu bằng !:', args[0]);
        }
    }
    
    return {
        anyEvent,
        onLoad,
        handleReaction,
        handleReply,
        handleEvent,
        handleCommand
    };
};
