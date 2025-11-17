export const getUserId=(u)=>{

    if(!u) return ""

    if(typeof u==="string") return u.toLowerCase()
    if(typeof u==="object"){
        if(u._id) return String(u._id).toLowerCase()
        if(u.id) return String(u.id).toLowerCase()
    }

    return String(u).toLowerCase()

}