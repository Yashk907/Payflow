import bcrypt from 'bcrypt'
import { kStringMaxLength } from 'buffer';
import db from '../db/config/knex.js';
import { email } from 'zod';
import { AppError } from '../utils/appError.js';
import { generateKey } from '../utils/ApiKey.js';

type MerchantRow = {id : string,name: string,email : string,created_at : string,api_key? : string}

const HASH_ROUNDS = 12;

const merchantSignUp = async (input : {
    name :string,
    email : string,
    password : string
})=>{
    try {
        const hashPassword = await bcrypt.hash(input.password,HASH_ROUNDS)
        const merchant: Array<MerchantRow> = await db('merchants')
        .insert({
            name : input.name,
            email : input.email,
            password_hash : hashPassword
        })
        .returning(['id','name','email','created_at'])

        //generating key
        const apiKey = generateKey();

        const keyInsert =await db('api_keys')
        .insert({
            merchant_id : merchant[0].id,
            key_prefix : apiKey.prefix_key,
            key_hash : apiKey.keyHash,
        })
        merchant[0].api_key = apiKey.fullKey;
        return merchant[0];
    } catch (err : any) {
        if(err.code == '23505'){
            throw new AppError(409,"email_taken","Email is already used!!")
        }
        throw err;
    }
}

export {merchantSignUp}
