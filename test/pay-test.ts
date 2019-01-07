import * as assert from "assert"
import {NewTestingServer, TestingServer} from './tools/test-tools'
import {TestUser} from './tools/test-user'
import {Underscore} from "duniter/app/lib/common-libs/underscore"
import {DBBlock} from "duniter/app/lib/db/DBBlock";
import {main} from '../lib/main'
import {typeDocument} from './tools/test-typedoc'

export const prepareDuniterServer = async (options:any) => {

  const catKeyring = { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'};
  const tacKeyring = { pub: '2LvDg21dVXvetTD9GdkPLURavLYEqP3whauvPWX4c2qc', sec: '2HuRLWgKgED1bVio1tdpeXrf7zuUszv1yPHDsDj7kcMC4rVSN9RC58ogjtKNfTbH1eFz7rn38U1PywNs3m6Q7UxE'};
  const remuniterKeyring = { pub: 'DNann1Lh55eZMEDXeYt59bzHbA3NJR46DeQYCS2qQdLV', sec: '468Q1XtTq7h84NorZdWBZFJrGkB18CbmbHr9tkp9snt5GiERP7ySs3wM8myLccbAAGejgMRC9rqnXuW3iAfZACm7'};

  const s1 = NewTestingServer(Underscore.extend({ pair: catKeyring }, options || {}));
  const sR = NewTestingServer(Underscore.extend({ pair: remuniterKeyring }, options || {}));

  const cat = {
    uid: 'cat',
    pub: catKeyring.pub,
    sec: catKeyring.sec
  }

  const tac = {
    uid: 'tac',
    pub: tacKeyring.pub,
    sec: tacKeyring.sec
  }

  const remuniter = {
    uid: 'remuniter',
    pub: remuniterKeyring.pub,
    sec: remuniterKeyring.sec
  }

  await s1._server.initWithDAL()
  await sR._server.initWithDAL()

  return { s1, sR, cat, tac, remuniter };
}

describe('Remuniter', () => {

  const now = 1480000000
  const payperiod = 3600 // Every hour loop
  const paychunk = 1
  const paystart = 0
  const payperblock = 25

  let s1: TestingServer
  let sR: TestingServer
  let cat: TestUser
  let tac: TestUser
  let remuniter: TestUser

  before(async () => {
    const { s1: _s1, sR: _sR, cat: _cat, tac: _tac, remuniter: _remu } = await prepareDuniterServer({
      dt: 1000,
      ud0: 200,
      udTime0: now - 1, // So we have a UD right on block#1
      medianTimeBlocks: 1 // Easy: medianTime(b) = time(b-1)
    })
    s1 = _s1
    sR = _sR
    cat = new TestUser(
      _cat.uid,
      _cat.pub,
      _cat.sec,
      s1._server
    )
    tac = new TestUser(
      _tac.uid,
      _tac.pub,
      _tac.sec,
      s1._server
    )
    remuniter = new TestUser(
      _remu.uid,
      _remu.pub,
      _remu.sec,
      s1._server
    )

    // Bidirectionnal communication
    s1._server
      .pipe(typeDocument())
      .pipe(sR._server)
    sR._server
      .pipe(typeDocument())
      .pipe(s1._server)
  })

  it('should be able to init a currency', async () => {
    await cat.createIdentityAndSubmit()
    await tac.createIdentityAndSubmit()
    await cat.createCertAndSubmit(tac)
    await tac.createCertAndSubmit(cat)
    await cat.createJoinAndSubmit()
    await tac.createJoinAndSubmit()
    await s1.commit({ time: now })
    const current = await s1._server.dal.getCurrentBlockOrNull()
    assert.notEqual(null, current)
    assert.equal(0, (current as DBBlock).number)
    assert.equal(cat.pub, (current as DBBlock).issuer)
    assert.equal(0, (current as DBBlock).issuersCount)
  })

  it('UD should be available at block#1 with UD', async () => {
    await s1.commit({ time: now })
    const current = await s1._server.dal.getCurrentBlockOrNull()
    assert.notEqual(null, current)
    assert.equal(1, (current as DBBlock).number)
    assert.equal(200, (current as DBBlock).dividend)
  })

  it('cat & tac should both have 200 units', async () => {
    assert.equal(200, (await cat.balance()))
    assert.equal(200, (await tac.balance()))
  })

  it('cat should be able to send money to remuniter', async () => {
    await cat.createTxAndSubmit(remuniter, 200)
    await tac.createTxAndSubmit(remuniter, 200)
    await s1.commit({ time: now })
    const current = await s1._server.dal.getCurrentBlockOrNull()
    assert.notEqual(null, current)
    assert.equal(2, (current as DBBlock).number)
    assert.equal(null, (current as DBBlock).dividend)
    assert.equal(2, (current as DBBlock).transactions.length)
  })

  it('cat should have 0 units', async () => {
    assert.equal(0, (await cat.balance()))
  })

  it('tac should have 0 units', async () => {
    assert.equal(0, (await tac.balance()))
  })

  it('remuniter should have 400 units', async () => {
    assert.equal(400, (await remuniter.balance()))
  })

  it('remuniter server should be synced', async () => {
    const current = await sR._server.dal.getCurrentBlockOrNull()
    assert.notEqual(null, current)
    assert.equal(2, (current as DBBlock).number)
    assert.equal(null, (current as DBBlock).dividend)
    assert.equal(2, (current as DBBlock).transactions.length)
  })

  it('remuniter should try to send money', async () => {
    await main(sR._server, payperiod, paychunk, paystart, payperblock)
    assert.equal(1, (await sR._server.dal.txsDAL.getAllPending(1)).length)
    await new Promise(res => setTimeout(res, 100)) // Wait just a little bit for tx processing
    assert.equal(1, (await s1._server.dal.txsDAL.getAllPending(1)).length)
    const b1 = await s1.commit({ time: now })
    assert.equal(1, b1.transactions.length)
    await main(sR._server, payperiod, paychunk, paystart, payperblock)
    const b2 = await s1.commit({ time: now })
    assert.equal(1, b2.transactions.length)
  })

  it('cat should have 50 units (two Remuniter gifts)', async () => {
    assert.equal(50, (await cat.balance()))
  })

})
