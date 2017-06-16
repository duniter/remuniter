"use strict";

const _ = require('underscore');
const co = require('co');
const moment = require('moment');

const BLOCKS_PER_WEEK = (60 / 5) * 24 * 7;

module.exports = (duniterServer, payperblock) => {

  const remuniterPubkey = duniterServer.PeeringService.pubkey;

  function existsTx(fromBlock, toBlock, txCategory) {
    return co(function *() {
      let txh = yield duniterServer.dal.getTransactionsHistory(remuniterPubkey);
      let txs = _.filter(txh[txCategory], (tx) => {
        let match = tx.comment && tx.comment.match(/^REMU:(\d+):(\d+)$/);
        if (!match) {
          return false;
        }
        let from = parseInt(match[1]);
        let to = parseInt(match[2]);
        return (from <= fromBlock && fromBlock <= to) || (from <= toBlock && toBlock <= to);
      });
      return txs.length > 0 && txs[0];
    });
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
        let match = (out || out.raw).match(/(\d+):(\d+):SIG\((.*)\)/);
        if (match) {
          let outputAmount = parseInt(match[1]) * Math.pow(10, parseInt(match[2]));
          if (tx.issuers.indexOf(match[3]) === -1) {
            totalGiven += outputAmount;
          }
        }
      });
      let localPayPerBlock = totalGiven / nbBlocks;
      let blocksIssuedInTx = _.filter(blocks, (b) => b.issuer == pubkey && b.number >= from && b.number <= to);
      let paidToPubkey = localPayPerBlock * blocksIssuedInTx.length;
      return sum + paidToPubkey;
    }, 0);
  }

  function getUID(pubkey) {
    return duniterServer.dal.getWrittenIdtyByPubkey(pubkey);
  }

  function getLastX(blocksCount) {
    return co(function *() {
      let current = yield duniterServer.dal.getCurrentBlockOrNull();
      if (!current) {
        return [];
      }
      if (blocksCount === undefined) {
        blocksCount = current.issuersFrame;
      }
      let blocks = yield duniterServer.dal.getBlocksBetween(current.number - blocksCount + 1, current.number);
      let txh = yield duniterServer.dal.getTransactionsHistory(remuniterPubkey);
      let stats = getStatsPerIssuer(blocks, payperblock);
      let issuers = _.keys(stats);
      for (let i = 0, len = issuers.length; i < len; i++) {
        stats[issuers[i]].idty = yield getUID(issuers[i]);
      }
      return issuers.map((issuer) => {
        return {
          name: stats[issuer].idty.uid,
          blocks: stats[issuer].blocks,
          amount: stats[issuer].amount,
          paid: getWhatWasPaid(issuer, txh, blocks)
        };
      });
    });
  }
  
  return {

    pubkey: remuniterPubkey,

    pay_per_block: payperblock,

    getCurrentBlock: duniterServer.dal.getCurrentBlockOrNull.bind(duniterServer.dal),

    getUID: getUID,

    remains: () => co(function *() {
      let sources = yield duniterServer.dal.getAvailableSourcesByPubkey(remuniterPubkey);
      return sources.reduce((sum, src) => sum + src.amount * Math.pow(10, src.base), 0);
    }),

    arePaid: (fromBlock, toBlock) => existsTx(fromBlock, toBlock, 'sent'),

    areBeingPaid: (fromBlock, toBlock) => existsTx(fromBlock, toBlock, 'sending'),

    getLastPaid: (fromBlock) => co(function *() {
      let txh = yield duniterServer.dal.getTransactionsHistory(remuniterPubkey);
      let lastTo = -1;
      txh['sent'].forEach((tx) => {
        let match = tx.comment && tx.comment.match(/^REMU:(\d+):(\d+)$/);
        if (!match) {
          return false;
        }
        let to = parseInt(match[2]);
        lastTo = Math.max(0, to);
      });
      return Math.max(fromBlock - 1, lastTo);
    }),

    pay: (fromBlock, toBlock) => co(function *() {
      let blocks = yield duniterServer.dal.getBlocksBetween(fromBlock, toBlock);
      let reallyPaid = payperblock * blocks.length; // Implicitely: amount in the current base
      let statsPerIssuer = getStatsPerIssuer(blocks, payperblock);
      let sources = yield duniterServer.dal.getAvailableSourcesByPubkey(remuniterPubkey);
      let current = yield duniterServer.dal.getCurrentBlockOrNull();
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

      let outputsToIssuers = _.keys(statsPerIssuer).map((issuer) => [statsPerIssuer[issuer].amount, maxBase, 'SIG(' + issuer + ')'].join(':'));

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
          comment: ['REMU', fromBlock, toBlock].join(':')
        };
        let rawTX = getRawTransaction(tx);

        // ----- SIGNATURE -----
        tx.signatures = [yield duniterServer.sign(rawTX)];

        // ----- SUBMITTING -----
        yield duniterServer.writeRaw(getRawTransaction(tx), 'transaction');

        return existsTx(fromBlock, toBlock, 'sending');
      }
      return false;
    }),
    
    lastDayTheoretical: () => getLastX(),
    lastWeekTheoretical: () => getLastX(BLOCKS_PER_WEEK),
    topGifts: () => co(function*() {
      const txs = yield duniterServer.dal.txsDAL.query('SELECT * ' +
        'FROM txs t ' +
        'WHERE t.outputs like ? ' +
        'AND t.issuers NOT LIKE ?' +
        'ORDER BY t.block_number DESC ' +
        'LIMIT 5', ['%SIG(' + remuniterPubkey + ')%', '["' + remuniterPubkey + '"]']);
      console.log(txs);
      const enriched = yield txs.map((tx) => co(function*() {
        let issuer = 'unknown';
        let amount = 0;
        for (const output of tx.outputs) {
          const sp = output.split(':');
          const src = {
            amount: parseInt(sp[0]),
            base: parseInt(sp[1]),
            conditions: sp[2]
          };
          if (src.conditions === 'SIG(' + remuniterPubkey + ')') {
            amount += src.amount * Math.pow(10, src.base);
          }
        }
        const block = yield duniterServer.dal.getBlock(tx.block_number);
        let date = moment(block.medianTime * 1000).format('YYYY-MM-DD HH:mm');
        if (tx.issuers.length === 1) {
          issuer = tx.issuers[0];
          const member = yield duniterServer.dal.getWritten(issuer);
          if (member) {
            issuer = member.uid;
          } else {
            issuer = issuer.substr(0, 8); // We keep only the 8 first key chars
          }
        }
        return { issuer, date, amount };
      }));
      return _.filter(enriched, (gift) => gift.issuer !== remuniterPubkey );
    }).catch((e) => console.error(e)),
  }
};

function getStatsPerIssuer(blocks, payperblock) {
  let amountsPerIssuer = {};
  blocks.forEach((b) => {
    amountsPerIssuer[b.issuer] = amountsPerIssuer[b.issuer] || { amount: 0, blocks: 0, real: 0 };
    amountsPerIssuer[b.issuer].blocks++;
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
