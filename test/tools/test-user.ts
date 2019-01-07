import {Buid} from "duniter/app/lib/common-libs/buid";
import {CommonConstants} from "duniter/app/lib/common-libs/constants";
import {IdentityDTO} from "duniter/app/lib/dto/IdentityDTO";
import {KeyGen} from "duniter/app/lib/common-libs/crypto/keyring";
import {CertificationDTO} from "duniter/app/lib/dto/CertificationDTO";
import {MembershipDTO} from "duniter/app/lib/dto/MembershipDTO";
import {Server} from "duniter/server";

export class TestUser {

  protected createdIdentity: IdentityDTO

  constructor(
    public readonly uid: string,
    public readonly pub: string,
    public readonly sec: string,
    public readonly server: Server) {}

  public async createIdentity(useRoot?:boolean|null) {
    const { current, currency } = await this.getCurrentAndCurrency()
    const buid = !useRoot && current ? Buid.format.buid(current.number, current.hash) : CommonConstants.SPECIAL_BLOCK
    this.createdIdentity = IdentityDTO.fromJSONObject({
      buid,
      uid: this.uid,
      issuer: this.pub,
      currency
    })
    const raw = this.createdIdentity.getRawUnSigned()
    this.createdIdentity.sig = KeyGen(this.pub, this.sec).signSync(raw)
  }

  private async getCurrentAndCurrency() {
    return {
      current: await this.server.dal.getCurrentBlockOrNull(),
      currency: await this.server.conf.currency,
    }
  }

  async createIdentityAndSubmit() {
    await this.createIdentity()
    await this.server.writeRawIdentity(this.createdIdentity.getRawSigned())
  }

  public async createCert(user: TestUser) {
    const { current, currency } = await this.getCurrentAndCurrency()
    const idty = await this.getPendingIdentity(user.pub)
    let buid = current ? Buid.format.buid(current.number, current.hash) : CommonConstants.SPECIAL_BLOCK
    const cert = {
      "version": CommonConstants.DOCUMENTS_VERSION,
      "currency": currency,
      "issuer": this.pub,
      "idty_issuer": user.pub,
      "idty_uid": idty.uid,
      "idty_buid": idty.buid,
      "idty_sig": idty.sig,
      "buid": buid,
      "sig": ""
    }
    const rawCert = CertificationDTO.fromJSONObject(cert).getRawUnSigned()
    cert.sig = KeyGen(this.pub, this.sec).signSync(rawCert)
    return CertificationDTO.fromJSONObject(cert)
  }

  public async createCertAndSubmit(user: TestUser) {
    const cert = await this.createCert(user)
    await this.server.writeRawCertification(cert.getRawSigned())
  }

  public async makeMembership(type:string) {
    const { current, currency } = await this.getCurrentAndCurrency()
    const idty = await this.getPendingIdentity(this.pub)
    const block = Buid.format.buid(current);
    const join = {
      "version": CommonConstants.DOCUMENTS_VERSION,
      "currency": currency,
      "issuer": this.pub,
      "block": block,
      "membership": type,
      "userid": this.uid,
      "certts": idty.buid,
      "signature": ""
    };
    const rawJoin = MembershipDTO.fromJSONObject(join).getRaw()
    join.signature = KeyGen(this.pub, this.sec).signSync(rawJoin)
    return MembershipDTO.fromJSONObject(join)
  }

  async createJoinAndSubmit() {
    const join = await this.makeMembership('IN')
    await this.server.writeRawMembership(join.getRawSigned())
  }

  async balance(): Promise<number> {
    const sources = await this.sourcesOfPubkey(this.pub)
    return sources.reduce((sum, src) => sum + src.amount * Math.pow(10, src.base), 0)
  }



  public async prepareITX(amount:number, recipient:TestUser|string, comment?:string) {
    let sources = []
    if (!amount || !recipient) {
      throw 'Amount and recipient are required'
    }
    const { current, currency } = await this.getCurrentAndCurrency()
    const version = current && Math.min(CommonConstants.LAST_VERSION_FOR_TX, current.version)
    const json = await this.sourcesOfPubkey(this.pub)
    let i = 0
    let cumulated = 0
    let commonbase = 99999999
    while (i < json.length) {
      const src = json[i]
      sources.push({
        'type': src.type,
        'amount': src.amount,
        'base': src.base,
        'noffset': src.noffset,
        'identifier': src.identifier
      })
      commonbase = Math.min(commonbase, src.base);
      cumulated += src.amount * Math.pow(10, src.base);
      i++;
    }
    if (cumulated < amount) {
      throw 'You do not have enough coins! (' + cumulated + ' ' + currency + ' left)';
    }
    let sources2 = [];
    let total = 0;
    for (let j = 0; j < sources.length && total < amount; j++) {
      let src = sources[j];
      total += src.amount * Math.pow(10, src.base);
      sources2.push(src);
    }
    let inputSum = 0;
    sources2.forEach((src) => inputSum += src.amount * Math.pow(10, src.base));
    let inputs = sources2.map((src) => {
      return {
        src: ([src.amount, src.base] as any[]).concat([src.type, src.identifier, src.noffset]).join(':'),
        unlock: 'SIG(0)'
      };
    });
    let outputs = [{
      qty: amount,
      base: commonbase,
      lock: 'SIG(' + (typeof recipient === 'string' ? recipient : recipient.pub) + ')'
    }];
    if (inputSum - amount > 0) {
      // Rest back to issuer
      outputs.push({
        qty: inputSum - amount,
        base: commonbase,
        lock: "SIG(" + this.pub + ")"
      });
    }
    let raw = this.prepareTX(inputs, outputs, {
      version: version,
      blockstamp: current && [current.number, current.hash].join('-'),
      comment: comment
    }, currency)
    return this.signed(raw)
  }

  public prepareTX(inputs:TestInput[], outputs:TestOutput[], theOptions:any, currency: string) {
    let opts = theOptions || {};
    let issuers = opts.issuers || [this.pub];
    let raw = '';
    raw += "Version: " + (opts.version || CommonConstants.TRANSACTION_VERSION) + '\n';
    raw += "Type: Transaction\n";
    raw += "Currency: " + (opts.currency || currency) + '\n';
    raw += "Blockstamp: " + opts.blockstamp + '\n';
    raw += "Locktime: " + (opts.locktime || 0) + '\n';
    raw += "Issuers:\n";
    issuers.forEach((issuer:string) => raw += issuer + '\n');
    raw += "Inputs:\n";
    inputs.forEach(function (input) {
      raw += input.src + '\n';
    });
    raw += "Unlocks:\n";
    inputs.forEach(function (input, index) {
      if (input.unlock) {
        raw += index + ":" + input.unlock + '\n';
      }
    });
    raw += "Outputs:\n";
    outputs.forEach(function (output) {
      raw += [output.qty, output.base, output.lock].join(':') + '\n';
    });
    raw += "Comment: " + (opts.comment || "") + "\n";
    return raw;
  }

  private signed(raw:string) {
    let signatures = [KeyGen(this.pub, this.sec).signSync(raw)]
    return raw + signatures.join('\n') + '\n'
  }

  async createTxAndSubmit(recipient: TestUser, amount: number, comment = '') {
    const raw = await this.prepareITX(amount, recipient, comment)
    await this.server.writeRawTransaction(raw)
  }

  private sourcesOfPubkey(pub: string) {
    return this.server.dal.getAvailableSourcesByPubkey(pub)
  }

  private async getPendingIdentity(pub: string) {
    return (await this.server.dal.getNonWritten(pub))[0]
  }
}


export interface TestInput {
  src:string
  unlock:string
}

export interface TestOutput {
  qty:number
  base:number
  lock:string
}
