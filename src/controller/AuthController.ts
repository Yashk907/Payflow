import bcrypt from 'bcrypt'
import { kStringMaxLength } from 'buffer';
import knex, { Knex } from 'knex'
import { email } from 'zod';
import { AppError } from '../utils/appError.js';

const HASH_ROUNDS = 12;

const merchantSignUp = async (input : {
    name :string,
    email : string,
    password : string
})=>{
    try {
        const hashPassword = bcrypt.hash(input.password,HASH_ROUNDS)
        const merchant = await knex('merchant')
        .insert({
            name : input.name,
            email : input.email,
            password : hashPassword
        }).returning(['id','name','email','created_at'])

        return merchant;
    } catch (err : any) {
        if(err.code == '23505'){
            throw new AppError(409,"email_taken","Email is already used!!")
        }
        throw err;
    }
}

export {merchantSignUp}
