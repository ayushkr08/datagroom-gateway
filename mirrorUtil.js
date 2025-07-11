// @ts-check

const logger = require('./logger');

// @ts-ignore
const MongoClient = require('mongodb').MongoClient;

class MongoDbClientWrapper {
    constructor (url) {
        this.url = url;
        this.client = null;
    }
    async connect () {
        this.client = await MongoClient.connect(this.url, { useNewUrlParser: true, useUnifiedTopology: true })
            .catch(err => { logger.error(err, "Error while connecting to Mongodb"); this.client = null; });
    }
    async deleteDb (dbName) {
        if (! this.client ) await this.connect();
        let db = this.client.db(dbName);
        return await db.dropDatabase();
    }
    async listDatabases () {
        if (! this.client ) await this.connect();
        let dbs = await this.client.db().admin().listDatabases();
        return dbs.databases;
    }
    async getClient() {
        if (! this.client ) await this.connect();
        return this.client
    }
}

async function deleteAll(url) {
    let dgVd = new MongoDbClientWrapper(url);
    let dgVdClient = await dgVd.getClient();

    let dbList = await dgVd.listDatabases();
    let sysDbs = ['admin', 'config', 'local'];
    for (let i = 0; i < dbList.length; i++) {
        let j = sysDbs.indexOf(dbList[i].name);
        if (j > -1)
            continue;
        await dgVd.deleteDb(dbList[i].name);
    }
    logger.info(`Done delete all`);
}

async function doIt(fromUrl, toUrl) {
    let from = new MongoDbClientWrapper(fromUrl);
    let fromClient = await from.getClient();
    let to = new MongoDbClientWrapper(toUrl);
    let toClient = await to.getClient();

    let dbList = await from.listDatabases();
    let sysDbs = ['admin', 'config', 'local'];
    let collections = ['data', 'metaData', 'editlog', 'attachments'];
    for (let i = 0; i < dbList.length; i++) {
        let j = sysDbs.indexOf(dbList[i].name);
        if (j > -1)
            continue;
        for (let j = 0; j < collections.length; j++) {
            let fromCol = fromClient.db(dbList[i].name).collection(collections[j]);
            let toCol = toClient.db(dbList[i].name).collection(collections[j]);
            let fn = null;

            const cursor = fromCol.find();
            for await (let doc of cursor) {
                if (fn) {
                    // @ts-ignore
                    doc = fn(doc);
                }
                let ret = await toCol.insertOne(doc);
                if (ret.result.ok !== 1) {
                    logger.warn(`InsertOne failed: ${ret.result}`);
                }
            }
        }
        logger.info(`Done copying: ${dbList[i].name}`);
    }

    dbList = await to.listDatabases();
    logger.info(dbList, "Copy done to destination");
}

// First, make sure no dbs are there in the destination. Use the below
// if needed. Run this from datagroom:~/datagroom-gateway
// ~/nodejs/node-v14.17.3-linux-x64/bin/node mirrorUtil.js
(async () => {
    await deleteAll('mongodb://in-debbld-33:27017');
    // Now copy everything. 
    doIt('mongodb://datagroom:27017', 'mongodb://in-debbld-33:27017');
})()

// scp -r attachments swuser@in-debbld-33:~/datagroom-gateway/
// After this, do an 'scp' to copy all attachments. Do this as 'root' from 
// in-mvlb52
// scp -r attachments swuser@in-datagroom-vd:~/datagroom-gateway/