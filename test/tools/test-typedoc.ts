import * as es from 'event-stream'

export function typeDocument() {
  return es.mapSync((obj: any) => {
    if (obj.joiners !== undefined) {
      obj.documentType = 'block'
    }
    else if (obj.bcEvent !== undefined) {
      return
    }
    else if (obj.wotb_id !== undefined) {
      obj.documentType = 'identity'
    }
    else if (obj.idty_issuer !== undefined) {
      obj.documentType = 'certification'
    }
    else if (obj.type === 'IN') {
      obj.documentType = 'membership'
    }
    else if (obj.unlocks !== undefined) {
      obj.documentType = 'transaction'
    }
    else {
      console.log('Unknown')
      console.log(obj)
    }
    return obj
  })
}