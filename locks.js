const logger = require("./logger");

var lockMap = {};

async function wait(ms) {
  await new Promise(resolve => setTimeout(() => resolve(), ms));
  return ms;
}

var isLocked = (key) => {
    return lockMap[key] && lockMap[key].locked;
}

var lock = async (key) => {
    if (lockMap[key] && lockMap[key].locked) {
        let p = new Promise ((resolve, reject) => {
                                f = () => {
                                    resolve();
                                    //logger.info("Lock obtained for: ", key)
                                };
                                lockMap[key].waiting.push(f);
                            });
        //logger.info("Queuing for lock: ", key);
        return p; 
    }
    //logger.info("Lock obtained for: ", key);
    lockMap[key] = {locked: true, waiting: []};
    return 1;
}

var unlock = async (key) => {
    if (lockMap[key] && lockMap[key].locked) {
        if (lockMap[key].waiting.length) {
            let f = lockMap[key].waiting.shift();
            f(); // resolve the next in line
            //logger.info("Dequeuing next in line for:", key);
        } else {
            delete lockMap[key];
            //logger.info("Last unlock done! : ", key);
        }
    } else {
        logger.warn(`Spurious unlock! : ${key}`);
    }
}


module.exports = {
    lock: lock,
    unlock: unlock,
    isLocked: isLocked
}