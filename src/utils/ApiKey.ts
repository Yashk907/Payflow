import crypto, { hash } from 'node:crypto'

const KEY_REGEX : RegExp = /^pf_live_[0-9a-f]{8}_[0-9a-f]{48}$/;

export function generateKey(){
    const id = crypto.randomBytes(4).toString('hex')
    const secret = crypto.randomBytes(24).toString('hex')

    const prefix_key = `pf_live_${id}`;
    const full_key = `${prefix_key}_${secret}`;
    return {
        fullKey : full_key,
        prefix_key : prefix_key,
        keyHash : hashKey(full_key)
    };
}

export function hashKey(key : string){
    return crypto.createHash('sha256').update(key).digest('hex')
}

export function parseKey(key : string) : {prefix : string} | null {
    if(!KEY_REGEX.exec(key)) return null;
    return {prefix : key.split('_').slice(0,3).join('_')};
}

export function hashesMatch(keyToBeMatched : string, hashedKey : string): boolean{
     return crypto.timingSafeEqual(Buffer.from(keyToBeMatched),Buffer.from(hashedKey))
}