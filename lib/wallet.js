"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
const underscore_1 = require("duniter/app/lib/common-libs/underscore");
const sqlAbstraction_1 = require("./sqlAbstraction");
const BLOCKS_PER_WEEK = (60 / 5) * 24 * 7;
function wallet(duniterServer, payperblock) {
    const remuniterPubkey = duniterServer.PeeringService.pubkey;
    function existsTx(fromBlock, toBlock, txCategory) {
        return (async () => {
            let txh = await duniterServer.dal.getTransactionsHistory(remuniterPubkey);
            let txs = underscore_1.Underscore.filter(txh[txCategory], (tx) => {
                let match = tx.comment && tx.comment.match(/^REMU:(\d+):(\d+)$/);
                if (!match) {
                    return false;
                }
                let from = parseInt(match[1]);
                let to = parseInt(match[2]);
                return (from <= fromBlock && fromBlock <= to) || (from <= toBlock && toBlock <= to);
            });
            return txs.length > 0 && txs[0];
        })();
    }
    function getWhatWasPaid(pubkey, txh, blocks) {
        return txh.sent.reduce((sum, tx) => {
            let match = tx.comment && tx.comment.match(/^REMU:(\d+):(\d+)$/);
            if (!match) {
                return false;
            }
            let from = parseInt(match[1]);
            let to = parseInt(match[2]);
            let nbBlocks = to - from + 1;
            let totalGiven = 0;
            tx.outputs.forEach((out) => {
                let match = String(out.raw || out).match(/(\d+):(\d+):SIG\((.*)\)/);
                if (match) {
                    let outputAmount = parseInt(match[1]) * Math.pow(10, parseInt(match[2]));
                    if (tx.issuers.indexOf(match[3]) === -1) {
                        totalGiven += outputAmount;
                    }
                }
            });
            let localPayPerBlock = totalGiven / nbBlocks;
            let blocksIssuedInTx = underscore_1.Underscore.filter(blocks, (b) => b.issuer == pubkey && b.number >= from && b.number <= to);
            let paidToPubkey = localPayPerBlock * blocksIssuedInTx.length;
            return sum + paidToPubkey;
        }, 0);
    }
    function getUID(pubkey) {
        return duniterServer.dal.getWrittenIdtyByPubkey(pubkey);
    }
    function getLastX(blocksCount) {
        return (async () => {
            let current = await duniterServer.dal.getCurrentBlockOrNull();
            if (!current) {
                return [];
            }
            if (blocksCount === undefined) {
                blocksCount = current.issuersFrame;
            }
            let blocks = await duniterServer.dal.getBlocksBetween(current.number - blocksCount + 1, current.number);
            let txh = await duniterServer.dal.getTransactionsHistory(remuniterPubkey);
            let stats = getStatsPerIssuer(blocks, payperblock);
            let issuers = underscore_1.Underscore.keys(stats);
            // If the data is for the current window view, calculate medianOfBlocksInFrame
            let medianOfBlocksInFrame = 0;
            if (blocksCount == current.issuersFrame) {
                let blocksPerIssuerInFrame = issuers.map(issuer => stats[issuer].blocks);
                blocksPerIssuerInFrame.sort((a, b) => a - b);
                medianOfBlocksInFrame = (blocksPerIssuerInFrame[(blocksPerIssuerInFrame.length - 1) >> 1] + blocksPerIssuerInFrame[blocksPerIssuerInFrame.length >> 1]) / 2;
            }
            // Memorize max value of blocks, diff, exclusionFactor and handicap
            let maxBlocks = 0;
            let maxDiff = 0;
            let maxExclusionFactor = 0;
            let maxHandicap = 0;
            for (let i = 0, len = issuers.length; i < len; i++) {
                stats[issuers[i]].idty = await getUID(issuers[i]);
                stats[issuers[i]].stringBlocks = stats[issuers[i]].blocks.toString();
                // If the data is for the current window view
                if (blocksCount == current.issuersFrame) {
                    // Calculate issuer handicap
                    let issuerExcess = ((stats[issuers[i]].blocks + 1) / (medianOfBlocksInFrame)) - 1;
                    if (issuerExcess < 0) {
                        issuerExcess = 0;
                    }
                    stats[issuers[i]].handicap = Math.floor(Math.log(1 + issuerExcess) / 0.17311261);
                    // Calculate issuer exclusionFactor
                    stats[issuers[i]].exclusionFactor = Math.max(1, Math.floor(0.67 * stats[issuers[i]].nbPreviousIssuers / (1 + (current.number - stats[issuers[i]].lastBlock))));
                    // Calculate issuer diff
                    stats[issuers[i]].diff = (current.powMin * stats[issuers[i]].exclusionFactor) + stats[issuers[i]].handicap;
                    // Calculate max value of blocks, diff, exclusionFactor and handicap
                    maxBlocks = (maxBlocks < stats[issuers[i]].blocks) ? stats[issuers[i]].blocks : maxBlocks;
                    maxDiff = parseInt(String((maxDiff < stats[issuers[i]].diff) ? stats[issuers[i]].diff : maxDiff));
                    maxExclusionFactor = parseInt(String((maxExclusionFactor < stats[issuers[i]].exclusionFactor) ? stats[issuers[i]].exclusionFactor : maxExclusionFactor));
                    maxHandicap = parseInt(String((maxHandicap < stats[issuers[i]].handicap) ? stats[issuers[i]].handicap : maxHandicap));
                }
            }
            // If the data is for the current window view, align field size of blocks, diff, exclusionFactor and handicap
            if (blocksCount == current.issuersFrame) {
                for (let i = 0, len = issuers.length; i < len; i++) {
                    // exclusionFactor and handicap : change the default to "-"
                    if (stats[issuers[i]].exclusionFactor == 1) {
                        stats[issuers[i]].exclusionFactor = "-";
                        for (let j = 1; j < maxExclusionFactor.toString().length; j++) {
                            stats[issuers[i]].exclusionFactor += "-";
                        }
                    }
                    if (stats[issuers[i]].handicap == 0) {
                        stats[issuers[i]].handicap = "-";
                        for (let j = 1; j < maxHandicap.toString().length; j++) {
                            stats[issuers[i]].handicap += "-";
                        }
                    }
                    // addition of "0" for alignment
                    for (let j = stats[issuers[i]].stringBlocks.length; j < maxBlocks.toString().length; j++) {
                        stats[issuers[i]].stringBlocks = "0" + stats[issuers[i]].stringBlocks;
                    }
                    // addition of "-" for alignment
                    for (let j = stats[issuers[i]].diff.toString().length; j < maxDiff.toString().length; j++) {
                        stats[issuers[i]].diff = stats[issuers[i]].diff + "-";
                    }
                    for (let j = stats[issuers[i]].exclusionFactor.toString().length; j < maxExclusionFactor.toString().length; j++) {
                        stats[issuers[i]].exclusionFactor = stats[issuers[i]].exclusionFactor + "-";
                    }
                    for (let j = stats[issuers[i]].handicap.toString().length; j < maxHandicap.toString().length; j++) {
                        stats[issuers[i]].handicap = stats[issuers[i]].handicap + "-";
                    }
                }
            }
            return issuers.map((issuer) => {
                return {
                    name: stats[issuer].idty.uid,
                    blocks: stats[issuer].blocks,
                    stringBlocks: stats[issuer].stringBlocks,
                    handicap: stats[issuer].handicap,
                    exclusionFactor: stats[issuer].exclusionFactor,
                    diff: stats[issuer].diff,
                    amount: stats[issuer].amount,
                    paid: getWhatWasPaid(issuer, txh, blocks)
                };
            });
        })();
    }
    return {
        pubkey: remuniterPubkey,
        pay_per_block: payperblock,
        getCurrentBlock: () => duniterServer.dal.getCurrentBlockOrNull(),
        getUID: getUID,
        remains: async () => {
            let sources = await duniterServer.dal.getAvailableSourcesByPubkey(remuniterPubkey);
            return sources.reduce((sum, src) => sum + src.amount * Math.pow(10, src.base), 0);
        },
        arePaid: (fromBlock, toBlock) => existsTx(fromBlock, toBlock, 'sent'),
        areBeingPaid: (fromBlock, toBlock) => existsTx(fromBlock, toBlock, 'sending'),
        getLastPaid: async (fromBlock) => {
            let txh = await duniterServer.dal.getTransactionsHistory(remuniterPubkey);
            let lastTo = -1;
            txh['sent'].forEach((tx) => {
                let match = tx.comment && tx.comment.match(/^REMU:(\d+):(\d+)$/);
                if (!match) {
                    return;
                }
                let to = parseInt(match[2]);
                lastTo = Math.max(0, to);
            });
            return Math.max(fromBlock - 1, lastTo);
        },
        pay: async (fromBlock, toBlock) => {
            let blocks = await duniterServer.dal.getBlocksBetween(fromBlock, toBlock);
            let reallyPaid = payperblock * blocks.length; // Implicitely: amount in the current base
            let statsPerIssuer = getStatsPerIssuer(blocks, payperblock);
            let sources = await duniterServer.dal.getAvailableSourcesByPubkey(remuniterPubkey);
            let current = await duniterServer.dal.getCurrentBlockOrNull();
            let maxBase = current.unitbase;
            const minBase = sources.reduce((min, src) => Math.min(min, src.base), 0);
            const bases = {};
            sources.forEach((src) => bases[src.base] = 0);
            sources.forEach((src) => bases[src.base] += src.amount);
            bases[maxBase] = bases[maxBase] || 0;
            // Try to convert 1 base to the other
            let outputsOfRests = [];
            for (let i = minBase; i < maxBase; i++) {
                bases[i] = bases[i] || 0;
                bases[i + 1] = bases[i + 1] || 0;
                const rest = bases[i] % 10;
                bases[i] -= rest;
                bases[i + 1] += bases[i] / 10;
                outputsOfRests.push([rest, i, 'SIG(' + remuniterPubkey + ')'].join(':'));
            }
            const availableMoney = bases[maxBase];
            let outputsToIssuers = underscore_1.Underscore.keys(statsPerIssuer).map((issuer) => [statsPerIssuer[issuer].amount, maxBase, 'SIG(' + issuer + ')'].join(':'));
            if (availableMoney >= reallyPaid) {
                let tx = {
                    documentType: 'transaction',
                    version: 10,
                    currency: duniterServer.conf.currency,
                    blockstamp: [current.number, current.hash].join('-'),
                    locktime: 0,
                    issuers: [remuniterPubkey],
                    inputs: sources.map((src) => [src.amount, src.base, src.type, src.identifier, src.pos].join(':')),
                    unlocks: sources.map((src, index) => [index, 'SIG(0)'].join(':')),
                    outputs: outputsOfRests.concat(outputsToIssuers).concat([availableMoney - reallyPaid, maxBase, 'SIG(' + remuniterPubkey + ')'].join(':')),
                    comment: ['REMU', fromBlock, toBlock].join(':'),
                    signatures: []
                };
                let rawTX = getRawTransaction(tx);
                // ----- SIGNATURE -----
                tx.signatures = [await duniterServer.sign(rawTX)];
                // ----- SUBMITTING -----
                await duniterServer.writeRawTransaction(getRawTransaction(tx));
                return existsTx(fromBlock, toBlock, 'sending');
            }
            return false;
        },
        lastDayTheoretical: () => getLastX(),
        lastWeekTheoretical: () => getLastX(BLOCKS_PER_WEEK),
        topGifts: async () => {
            const txs = await sqlAbstraction_1.getTxsDAL(duniterServer).sqlRead('SELECT * ' +
                'FROM txs t ' +
                'WHERE t.outputs like ? ' +
                'AND t.issuers NOT LIKE ?' +
                'ORDER BY t.block_number DESC ' +
                'LIMIT 5', ['%SIG(' + remuniterPubkey + ')%', '["' + remuniterPubkey + '"]']);
            console.log(txs);
            const enriched = await Promise.all(txs.map(async (tx) => {
                let issuer = 'unknown';
                let amount = 0;
                for (const output of tx.outputs) {
                    const sp = (output.raw || output).split(':');
                    const src = {
                        amount: parseInt(sp[0]),
                        base: parseInt(sp[1]),
                        conditions: sp[2]
                    };
                    if (src.conditions === 'SIG(' + remuniterPubkey + ')') {
                        amount += src.amount * Math.pow(10, src.base);
                    }
                }
                const block = await duniterServer.dal.getBlock(tx.block_number);
                let date = moment(block.medianTime * 1000).format('YYYY-MM-DD HH:mm');
                if (tx.issuers.length === 1) {
                    issuer = tx.issuers[0];
                    const member = await duniterServer.dal.getWrittenIdtyByPubkeyForUidAndPubkey(issuer);
                    if (member) {
                        issuer = member.uid;
                    }
                    else {
                        issuer = issuer.substr(0, 8); // We keep only the 8 first key chars
                    }
                }
                return { issuer, date, amount };
            }));
            return underscore_1.Underscore.filter(enriched, (gift) => gift.issuer !== remuniterPubkey);
        },
    };
}
exports.wallet = wallet;
function getStatsPerIssuer(blocks, payperblock) {
    let amountsPerIssuer = {};
    blocks.forEach((b) => {
        amountsPerIssuer[b.issuer] = amountsPerIssuer[b.issuer] || { amount: 0, blocks: 0, real: 0 };
        amountsPerIssuer[b.issuer].blocks++;
        amountsPerIssuer[b.issuer].lastBlock = b.number;
        amountsPerIssuer[b.issuer].nbPreviousIssuers = b.issuersCount;
        amountsPerIssuer[b.issuer].amount += payperblock;
    });
    return amountsPerIssuer;
}
function getRawTransaction(json) {
    let raw = "";
    raw += "Version: " + (json.version) + "\n";
    raw += "Type: Transaction\n";
    raw += "Currency: " + json.currency + "\n";
    raw += "Blockstamp: " + json.blockstamp + "\n";
    raw += "Locktime: " + json.locktime + "\n";
    raw += "Issuers:\n";
    (json.issuers || []).forEach(function (issuer) {
        raw += issuer + '\n';
    });
    raw += "Inputs:\n";
    (json.inputs || []).forEach(function (input) {
        raw += input + '\n';
    });
    raw += "Unlocks:\n";
    (json.unlocks || []).forEach(function (input) {
        raw += input + '\n';
    });
    raw += "Outputs:\n";
    (json.outputs || []).forEach(function (output) {
        raw += output + '\n';
    });
    raw += "Comment: " + (json.comment || "") + "\n";
    (json.signatures || []).forEach(function (signature) {
        raw += signature + '\n';
    });
    return raw;
}
//# sourceMappingURL=wallet.js.map