import db from "../db/config/knex.js"
import { AppError } from "../utils/appError.js";

const disableMerchantStatus = async(merchant_Id : string)=>{
    const updatedMerchant = await db('merchants')
    .where('id',merchant_Id)
    .whereNot('status','disable')
    .update({status:'disable'})
    .returning(['id','status'])

    if(updatedMerchant.length==0) throw new AppError(400,'already_exist','merchant is already disabled!!');
    return updatedMerchant;
}

const enableMerchantStatus = async(merchant_Id : string)=>{
    const updatedMerchant = await db('merchants')
    .where('id',merchant_Id)
    .whereNot('status','active')
    .update({status:'active'})
    .returning(['id','status'])

    if(updatedMerchant.length==0) throw new AppError(400,'already_exist','merchant is already enabled!!');
    return updatedMerchant;
}

export {disableMerchantStatus,enableMerchantStatus}