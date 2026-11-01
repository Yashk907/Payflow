import { fetchPaymentStatus } from "./bankService.js"
import { transitionPayment } from "./stateMachine.js";

export const reconcilePayment = async (reference : string)=>{
    const fetchStatusofPayment = await fetchPaymentStatus(reference);
    //call stateMachine for rule check 
    if(fetchStatusofPayment && fetchStatusofPayment.status){
//const transition = await transitionPayment(reference,fetchStatusofPayment?.status)
}
    }
    